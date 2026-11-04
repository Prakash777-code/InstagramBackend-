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
import { Prisma } from '@prisma/client';

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
    const res = await this.cloudinaryService.uploadPost(image);
    await this.prisma.posts.create({
      data: {
        imageHash: imageHash,
        userId: userId,
        postUrl: res.secure_url,
      },
    });
    await this.cacheManager.del(`allPosts`);
    await this.cacheManager.del(`userPosts:${userId}`);
    await this.cacheManager.del(`userProfile:${userId}`);
    await this.invalidateNormalFeedCache();
    await this.invalidateUserFeedCache();
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
    const totalPosts = await this.prisma.posts.count();
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
        const isFollowing = await this.prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followingId: post.userId,
              followerId: userId,
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
          isFollowing: isFollowing != null,
        };
      }),
    );
    return {
      data: posts,
      totalPosts: totalPosts,
    };
  }

  async getUserProfile(userId: number) {
    console.log('REACHED GET PROOFILE', userId);
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
    const followers = await this.prisma.follow.count({
      where: {
        followingId: userId,
      },
    });
    const following = await this.prisma.follow.count({
      where: {
        followerId: userId,
      },
    });
    const profile = {
      name: user.name,
      posts: user.posts,
      followers: followers,
      following: following,
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
    await this.cacheManager.del(`userProfile:${userId}`);
    await this.invalidateNormalFeedCache();
    await this.invalidateUserFeedCache();
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
    await this.invalidateNormalFeedCache();
    await this.invalidateUserFeedCache();
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
          senderId: userId,
          userName: userDetails.name,
        },
      });
      console.log('SEDNING NOTIFOCATION');
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
        try {
          const result = await this.firebaseService.sendNotification(
            deviceTokens,
            'New Like',
            `${userDetails.name} liked your post at ${time}`,
          );
        } catch (e) {
          console.log('ERROR WHILE SENDING LIKE NOTIFICATION ', e);
        }
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
      select: {
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
    await this.invalidateNormalFeedCache();
    await this.invalidateUserFeedCache();
    const postOwner = await this.prisma.posts.findUnique({
      where: {
        id: postId,
      },
    });
    if (!postOwner) {
      throw new NotFoundException('Owner not found');
    }
    const userDetails = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });
    if (!userDetails) {
      throw new BadRequestException('User not found');
    }
    if (userId != postOwner.userId) {
      await this.prisma.notification.deleteMany({
        where: {
          userId: postOwner.userId,
          postId: postId,
          userName: userDetails.name,
          imageUrl: isPost.postUrl,
        },
      });
    }
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
    const skip = (page - 1) * limit;
    const res = await this.prisma.notification.findMany({
      skip,
      take: limit,
      where: {
        userId,
      },
      select: {
        id: true,
        userId: true,
        senderId: true,
        postId: true,
        imageUrl: true,
        userName: true,
        notificationType: true,
        seen: true,
        created_at: true,
        post: {
          select: {
            userId: true,
          },
        },
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
    await this.invalidateNormalFeedCache();
    await this.invalidateUserFeedCache();
    const totalNotifications = await this.prisma.notification.count({
      where: {
        userId: userId,
      },
    });
    const followingIds = await this.prisma.follow.findMany({
      where: {
        followerId: userId,
      },
      select: {
        followingId: true,
      },
    });
    return {
      data: res,
      followingIds: followingIds,
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

  async follow(userId: number, profileId: number) {
    if (!profileId) {
      throw new BadRequestException('Profile ID cannot be empty');
    }
    const user = await this.prisma.user.findUnique({
      where: {
        id: profileId,
      },
    });
    if (!user) {
      throw new NotFoundException('Profile not found');
    }
    const sender = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });
    console.log(user.name, 'GOT FOLLOWED BY ', userId);
    if (userId === profileId) {
      return;
    }
    try {
      const res = await this.prisma.follow.create({
        data: {
          followerId: userId,
          followingId: profileId,
        },
      });
      await this.invalidateNormalFeedCache();
      await this.invalidateUserFeedCache();
      await this.cacheManager.del(`userProfile:${userId}`);
      if (userId !== profileId) {
        await this.prisma.notification.create({
          data: {
            userId: profileId,
            senderId: userId,
            userName: sender!.name,
            notificationType: 'FOLLOW',
          },
        });
        const tokens = await this.prisma.deviceToken.findMany({
          where: {
            userId: profileId,
          },
          select: {
            fcmToken: true,
          },
        });
        const fcmTokens = tokens.map((token) => token.fcmToken);
        if (fcmTokens.length > 0) {
          const time = new Date().toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: 'numeric',
            minute: '2-digit',
          });
          try {
            await this.firebaseService.sendNotification(
              fcmTokens,
              'New follower',
              `${sender!.name} started following you  ${time}`,
            );
          } catch (e) {
            console.log('ERROR WHILE SENDING FOLLOW NOTIFICATION ', e);
          }
        }
      }
      return {
        success: true,
        message: 'Followed successfully',
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('You already follow this profile');
      }
    }
  }

  async unFollow(userId: number, profileId: number) {
    if (!profileId) {
      throw new BadRequestException('Profile ID cannot be empty');
    }
    const user = await this.prisma.user.findUnique({
      where: {
        id: profileId,
      },
    });
    if (!user) {
      throw new NotFoundException('Profile not found');
    }
    const existingFollow = await this.prisma.follow.findFirst({
      where: {
        followerId: userId,
        followingId: profileId,
      },
    });

    console.log('UNFOLLOW USER:', userId);
    console.log('UNFOLLOW PROFILE:', profileId);
    console.log('EXISTING FOLLOW:', existingFollow);
    const deleteRecord = await this.prisma.follow.deleteMany({
      where: {
        followingId: profileId,
        followerId: userId,
      },
    });
    await this.cacheManager.del(`userProfile:${userId}`);
    if (deleteRecord.count === 0) {
      throw new NotFoundException('You do not follow this profile');
    }
    const notificationRecord = await this.prisma.notification.deleteMany({
      where: {
        userId: profileId,
        senderId: userId,
        notificationType: 'FOLLOW',
      },
    });
    await this.invalidateNormalFeedCache();
    await this.invalidateUserFeedCache();
    console.log('NotifiationRecord', notificationRecord);
    return {
      success: true,
      message: 'Unfollowed successfully',
    };
  }

  async getUserFollowingPosts(userId: number, page: number, limit: number) {
    if (!page || !limit) {
      throw new BadRequestException('Page and limit are required');
    }
    if (page < 1 || limit < 1) {
      throw new BadRequestException('Page and limit cannot be less than 1');
    }
    console.log('GETTING POSTS FOR ', userId);
    const skip = (page - 1) * limit;
    const followingIds = await this.prisma.follow.findMany({
      where: {
        followerId: userId,
      },
      select: {
        followingId: true,
      },
    });
    console.log(
      `${userId} FOLLOWING IDS :${followingIds.map((id) => id.followingId)}`,
    );
    const totalPosts = await this.prisma.posts.count({
      where: {
        userId: { in: followingIds.map((id) => id.followingId) },
      },
    });
    const userFeedCacheVersion =
      (await this.cacheManager.get<number>(`user-feed-cache`)) ?? 1;
    const userFeedKey = `userId${userId}:page:${page}:limit${limit}v:v${userFeedCacheVersion}`;
    const userFeedCacheData = await this.cacheManager.get(userFeedKey);
    if (userFeedCacheData) {
      return {
        success: true,
        source: 'Cache',
        feedType: 'User feed',
        userFeed: userFeedCacheData,
        totalPosts: totalPosts,
      };
    }
    const userFeed = await this.prisma.posts.findMany({
      where: {
        userId: {
          in: followingIds.map((id) => id.followingId),
        },
      },
      skip: skip,
      take: limit,
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
      orderBy: {
        createdAt: 'desc',
      },
    });
    if (followingIds.length === 0 || userFeed.length === 0) {
      console.log('GETTING NORMAL FEED');
      const normalFeedVersion =
        (await this.cacheManager.get<number>(`normal-feed-cache`)) ?? 1;
      const normalFeedKey = `userId${userId}:page:${page}:limit${limit}:v${normalFeedVersion}`;
      const totalPosts = await this.prisma.posts.count();
      const normalFeedCachedData = await this.cacheManager.get(normalFeedKey);
      if (normalFeedCachedData) {
        return {
          success: true,
          source: 'Cache',
          feedType: 'Normal',
          userFeed: normalFeedCachedData,
          totalPosts: totalPosts,
        };
      }
      const normalFeed = await this.prisma.posts.findMany({
        skip: skip,
        take: limit,
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
      await this.cacheManager.set(normalFeedKey, normalFeed);
      return {
        success: true,
        source: 'Database',
        feedType: 'Normal',
        userFeed: normalFeed,
        totalPosts: totalPosts,
      };
    } else {
      console.log('GETTING USER FEED');
      await this.cacheManager.set(userFeedKey, userFeed);
      return {
        success: true,
        source: 'Database',
        feedType: 'User feed',
        userFeed: userFeed,
        totalPosts: totalPosts,
      };
    }
  }

  async getUserLikedPostIds(userId: number, postIds: number[]) {
    if (!postIds) {
      throw new BadRequestException('Post IDs are required');
    }
    const likedIds = await this.prisma.like.findMany({
      where: {
        userId: userId,
        postId: {
          in: postIds,
        },
      },
      select: {
        postId: true,
      },
    });
    return {
      likedIds: likedIds.map((id) => id.postId),
    };
  }

  async getUserFollowingIds(userId: number, userIds: number[]) {
    if (!userIds || userIds.length == 0) {
      throw new BadRequestException('User IDs are required');
    }
    const followingIds = await this.prisma.follow.findMany({
      where: {
        followerId: userId,
        followingId: {
          in: userIds,
        },
      },
      select: {
        followingId: true,
      },
    });
    return {
      success: true,
      followingIds: followingIds.map((id) => id.followingId),
    };
  }

  async invalidateNormalFeedCache() {
    const version =
      (await this.cacheManager.get<number>(`normal-feed-cache`)) ?? 1;
    await this.cacheManager.set(`normal-feed-cache`, version + 1);
  }

  async invalidateUserFeedCache() {
    const version =
      (await this.cacheManager.get<number>(`user-feed-cache`)) ?? 1;
    await this.cacheManager.set(`user-feed-cache`, version + 1);
  }
}
