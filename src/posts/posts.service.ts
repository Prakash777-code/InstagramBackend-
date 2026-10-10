import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { createHash } from 'crypto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { FirebaseService } from '../services/firebase.service';
import { Helper } from './utils/helper';

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
    private firebaseService: FirebaseService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private helper: Helper,
  ) {}

  async uploadPost(image: Express.Multer.File, userId: number) {
    if (!image) {
      throw new BadRequestException('File is required');
    }
    const imageHash = createHash('sha256').update(image.buffer).digest('hex');
    console.log('Image hash: ', imageHash);
    const existingPost = await this.prisma.posts.findUnique({
      where: {
        imageHash: imageHash,
      },
    });
    if (existingPost) {
      console.log('Found existing posts', existingPost);
      throw new ConflictException('This post has been already uploaded');
    }
    const res = await this.cloudinaryService.uploadWallpaper(image);
    await this.prisma.posts.create({
      data: {
        imageHash: imageHash,
        userId: userId,
        postUrl: res.secure_url,
      },
    });
    await this.invalidatePostsCache();
    await this.cacheManager.del(`allPosts`);
    await this.cacheManager.del(`userPosts:${userId}`);
    await this.cacheManager.del(`userProfile:${userId}`);
    return {
      message: 'Post uploaded',
      postUrl: res.secure_url,
    };
  }

  async getPosts(page: number, limit: number, userId: number) {
    if (page < 1 || limit < 1) {
      throw new BadRequestException('Page and limit must me greater than 0');
    }
    if (!page || !limit) {
      throw new BadRequestException('Queries are missing');
    }
    const version =
      (await this.cacheManager.get<number>('all-posts-version')) ?? 1;
    const key = `all-posts:v${version}:page:${page}:limit:${limit}:user:${userId}`;
    const cachedData = await this.cacheManager.get(key);
    const totalPosts = await this.prisma.posts.count();
    if (cachedData) {
      return {
        source: 'Cache',
        data: cachedData,
        totalPosts: totalPosts,
      };
    }
    const skip = (page - 1) * limit;
    const res = await this.prisma.posts.findMany({
      skip: skip,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        userId: true,
        postUrl: true,
        user: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            likes: true,
          },
        },
      },
    });
    const posts = await Promise.all(
      res.map(async (post) => {
        const isLiked = await this.prisma.like.findUnique({
          where: {
            userId_postId: {
              userId: userId,
              postId: post.id,
            },
          },
        });
        return {
          id: post.id,
          userId: post.userId,
          name: post.user.name,
          postUrl: post.postUrl,
          likes: post._count.likes,
          isLiked: isLiked != null,
        };
      }),
    );
    await this.cacheManager.set(key, posts, 30 * 60 * 1000);
    return {
      source: 'Database',
      data: posts,
      totalPosts: totalPosts,
    };
  }

  async getUserProfile(userId: number) {
    const key = `userProfile:${userId}`;
    const cachedData = await this.cacheManager.get(key);
    if (cachedData) {
      return {
        source: 'Cache',
        data: cachedData,
      };
    }
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        name: true,
        posts: {
          select: {
            id: true,
            userId: true,
            postUrl: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const profile = {
      name: user.name,
      posts: user.posts,
    };
    await this.cacheManager.set(key, profile);
    return {
      source: 'Database',
      data: profile,
    };
  }

  async deletePost(userId: number, postId: number) {
    const postExist = await this.prisma.posts.findUnique({
      where: {
        userId: userId,
        id: postId,
      },
    });
    if (!postExist) {
      throw new NotFoundException('Post not found');
    }
    await this.prisma.posts.delete({
      where: {
        userId: userId,
        id: postId,
      },
    });
    await this.cacheManager.del(`userPosts:${userId}`);
    await this.cacheManager.del(`userProfile:${userId}`);
    await this.invalidatePostsCache();
    return {
      message: 'Post deleted',
    };
  }

  async likePost(userId: number, postId: number) {
    const isPost = await this.prisma.posts.findUnique({
      where: {
        id: postId,
      },
      select: {
        userId: true,
        postUrl: true,
      },
    });
    if (!isPost) {
      throw new NotFoundException('Post not found');
    }
    const isLiked = await this.prisma.like.findUnique({
      where: {
        userId_postId: {
          userId: userId,
          postId: postId,
        },
      },
    });
    if (isLiked) {
      throw new ConflictException('Post already liked');
    }
    await this.prisma.like.create({
      data: {
        userId: userId,
        postId: postId,
      },
    });
    const userDetails = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });
    if (!userDetails) {
      throw new NotFoundException('User not found');
    }
    if (userId !== isPost.userId) {
      const res = await this.prisma.notification.create({
        data: {
          postId: postId,
          imageUrl: isPost.postUrl,
          userId: isPost.userId,
          userName: userDetails.name,
        },
      });
      console.log('SEDNING NOTIFOCATION');
      await this.invalidateNotificationCache();
      const tokens = await this.prisma.deviceToken.findMany({
        where: {
          userId: isPost.userId,
        },
        select: {
          fcmToken: true,
        },
      });
      const deviceTokens = tokens.map((item) => item.fcmToken);
      if (deviceTokens.length > 0) {
        const time = new Date().toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: 'numeric',
          minute: '2-digit',
        });
        const formattedTime = this.helper.getTimeAgo(new Date());
        const result = await this.firebaseService.sendMultipleNotifications(
          deviceTokens,
          'New Like',
          `${userDetails.name} liked your post at ${time}`,
        );
        console.log('NOTIFICATION SENDED', result);
      }
      console.log(res);
    }
    const likes = await this.prisma.like.count({
      where: {
        postId: postId,
      },
    });
    return {
      message: 'Post liked',
      likes: likes,
    };
  }

  async unlikePost(userId: number, postId: number) {
    const isPost = await this.prisma.posts.findUnique({
      where: {
        id: postId,
      },
    });
    if (!isPost) {
      throw new NotFoundException('Post not found');
    }
    const isLiked = await this.prisma.like.findUnique({
      where: {
        userId_postId: {
          userId: userId,
          postId: postId,
        },
      },
    });
    if (!isLiked) {
      throw new BadRequestException('Post already not liked');
    }
    await this.prisma.like.delete({
      where: {
        userId_postId: {
          userId: userId,
          postId: postId,
        },
      },
    });
    const postOwner = await this.prisma.posts.findUnique({
      where: {
        id: postId,
      },
    });
    if (!postOwner) {
      throw new NotFoundException('Owner not found');
    }
    await this.prisma.notification.deleteMany({
      where: {
        userId: postOwner.userId,
        postId: postId,
      },
    });
    await this.invalidateNotificationCache();
    return {
      success: true,
      message: 'Post unliked',
    };
  }

  async getUserNotification(userId: number, page: number, limit: number) {
    if (userId < 1) {
      throw new NotFoundException('User not found ');
    }
    if (!page || !limit || page < 1 || limit < 1) {
      throw new BadRequestException('Page and limit must be positive integers');
    }
    const totalNotifications = await this.prisma.notification.count({
      where: {
        userId: userId,
      },
    });
    const version =
      (await this.cacheManager.get<number>('notification-version')) ?? 1;
    const key = `notification:userId:${userId}:v${version}:page:${page}:limit:${limit}`;
    const cachedData = await this.cacheManager.get(key);
    if (cachedData) {
      await this.prisma.notification.updateMany({
        where: {
          userId: userId,
          seen: false,
        },
        data: {
          seen: true,
        },
      });
      return {
        source: 'Cache',
        data: cachedData,
        totalNotifications: totalNotifications,
      };
    }
    const skip = (page - 1) * limit;
    const res = await this.prisma.notification.findMany({
      skip: skip,
      take: limit,
      where: {
        userId: userId,
      },
      orderBy: {
        created_at: 'desc',
      },
    });
    await this.prisma.notification.updateMany({
      where: {
        userId: userId,
        seen: false,
      },
      data: {
        seen: true,
      },
    });
    await this.cacheManager.set(key, res);
    return {
      source: 'Database',
      data: res,
      totalNotifications: totalNotifications,
    };
  }

  async hasUnreadNotification(userId: number) {
    const unread = await this.prisma.notification.count({
      where: {
        userId: userId,
        seen: false,
      },
    });
    return {
      unread: unread > 0,
    };
  }

  async saveFcmToken(userId: number, fcmToken: string) {
    if (!fcmToken) {
      throw new BadRequestException('FCM is missing');
    }
    await this.prisma.deviceToken.upsert({
      where: {
        fcmToken,
      },
      update: {
        userId,
      },
      create: {
        fcmToken,
        userId,
      },
    });
    return {
      message: 'FCM saved',
    };
  }

  async deleteFcmToken(userId: number, fcmToken: string) {
    if (!fcmToken) {
      throw new BadRequestException('FCM token is missing');
    }
    await this.prisma.deviceToken.delete({
      where: {
        userId: userId,
        fcmToken: fcmToken,
      },
    });
    return {
      message: 'FCM removed',
    };
  }

  async invalidatePostsCache() {
    const version =
      (await this.cacheManager.get<number>('all-posts-version')) ?? 1;
    await this.cacheManager.set('all-posts-version', version + 1);
  }

  async invalidateNotificationCache() {
    const version =
      (await this.cacheManager.get<number>('notification-version')) ?? 1;
    await this.cacheManager.set('notification-version', version + 1);
  }
}
