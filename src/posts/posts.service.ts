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

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
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
    await this.cacheManager.del(`userPosts:${userId}`);
    await this.cacheManager.del(`userProfile:${userId}`);
    return {
      message: 'Post uploaded',
      postUrl: res.secure_url,
    };
  }

  async getPosts(page: number, limit: number, userId: number) {
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
    return {
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
    return {
      message: 'Post deleted',
    };
  }

  async likePost(userId: number, postId: number) {
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
    if (isLiked) {
      throw new ConflictException('Post already liked');
    }
    await this.prisma.like.create({
      data: {
        userId: userId,
        postId: postId,
      },
    });
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
    return {
      success: true,
      message: 'Post unliked',
    };
  }
}
