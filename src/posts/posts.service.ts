import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
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
    await this.cacheManager.del(`allPosts`);
    await this.cacheManager.del(`userPosts:${userId}`);
    return {
      message: 'Post uploaded',
      postUrl: res.secure_url,
    };
  }

  async getPosts() {
    const key = `allPosts`;

    const cachedData = await this.cacheManager.get(key);

    if (cachedData) {
      return {
        source: 'Cache',
        data: cachedData,
      };
    }

    const res = await this.prisma.posts.findMany({
      select: {
        id: true,
        userId: true,
        postUrl: true,
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    const posts = res.map((post) => {
      return {
        id: post.id,
        userId: post.userId,
        postUrl: post.postUrl,
        name: post.user.name,
      };
    });

    await this.cacheManager.set(key, posts);

    return {
      source: 'Database',
      data: posts,
    };
  }

  async getUserProfile(userId: number) {
    const key = `userPosts:${userId}`;
    const cachedData = await this.cacheManager.get(key);
    if (cachedData) {
      return {
        source: 'Cache',
        data: cachedData,
      };
    }
    const posts = await this.prisma.posts.findMany({
      where: {
        userId: userId,
      },
      select: {
        id: true,
        userId: true,
        postUrl: true,
        createdAt: true,
        user: {
          select: {
            name: true,
          },
        },
      },
    });
    const profile = posts.map((post) => {
      return {
        id: post.id,
        userId: post.userId,
        postUrl: post.postUrl,
        name: post.user.name,
        createdAt: post.createdAt,
      };
    });
    await this.cacheManager.set(key, profile);
    return {
      source: 'Database',
      posts: profile,
    };
  }
}
