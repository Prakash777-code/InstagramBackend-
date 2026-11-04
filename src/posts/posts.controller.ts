import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import type { AuthRequest } from '../auth/interfaces/authRequest';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';

@Controller('posts')
@UseGuards(AuthGuard('jwt'))
export class PostsController {
  constructor(private postService: PostsService) {}

  @Post('upload')
  @Throttle({
    default: {
      limit: 4,
      ttl: 60000,
    },
  })
  @UseInterceptors(
    FileInterceptor('image', {
      limits: {
        fileSize: 3 * 1024 * 1024,
      },
    }),
  )
  async upload(
    @UploadedFile() image: Express.Multer.File,
    @Req() request: AuthRequest,
  ) {
    return this.postService.uploadPost(image, request.user.userId);
  }

  @Get()
  @SkipThrottle()
  async getPosts(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Req() request: AuthRequest,
  ) {
    return this.postService.getPosts(
      Number(page),
      Number(limit),
      request.user.userId,
    );
  }

  @Get('user')
  @SkipThrottle()
  async getPostsByUserId(@Req() request: AuthRequest) {
    return this.postService.getUserProfile(request.user.userId);
  }

  @Delete('post/:id')
  @Throttle({
    default: {
      limit: 4,
      ttl: 60000,
    },
  })
  async deletPost(
    @Req() request: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.postService.deletePost(request.user.userId, id);
  }

  @Post('like/:id')
  @Throttle({
    default: {
      limit: 40,
      ttl: 60000,
    },
  })
  async likePost(
    @Req() request: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.postService.likePost(request.user.userId, id);
  }

  @Delete('like/:id')
  @SkipThrottle()
  async unlikePost(
    @Req() request: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.postService.unlikePost(request.user.userId, id);
  }

  @Get('notification')
  @SkipThrottle()
  async getUserNotification(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Req() request: AuthRequest,
  ) {
    return this.postService.getUserNotification(
      request.user.userId,
      Number(page),
      Number(limit),
    );
  }

  @Get('unread')
  @SkipThrottle()
  async getUnreadNotificationCount(@Req() request: AuthRequest) {
    return this.postService.hasUnreadNotification(request.user.userId);
  }

  @Post('notifications/fcm-token')
  async saveFcmToken(
    @Req() request: AuthRequest,
    @Body('fcmToken') fcmToken: string,
  ) {
    return this.postService.saveFcmToken(request.user.userId, fcmToken);
  }

  @Delete('notification/fcm')
  async deleteFcmToken(
    @Req() request: AuthRequest,
    @Body('fcmToken') fcmToken: string,
  ) {
    return this.postService.deleteFcmToken(request.user.userId, fcmToken);
  }

  @Post('follow/:profileId')
  @Throttle({
    default: {
      limit: 10,
      ttl: 60000,
    },
  })
  async follow(
    @Req() req: AuthRequest,
    @Param('profileId', ParseIntPipe) profileId: number,
  ) {
    return this.postService.follow(req.user.userId, profileId);
  }

  @Delete('unfollow/:profileId')
  @Throttle({
    default: {
      limit: 10,
      ttl: 60000,
    },
  })
  async unFollow(
    @Req() req: AuthRequest,
    @Param('profileId', ParseIntPipe) profileId: number,
  ) {
    return this.postService.unFollow(req.user.userId, profileId);
  }

  @Get('user-feed')
  @SkipThrottle()
  async getUserFollowingPosts(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Req() request: AuthRequest,
  ) {
    return this.postService.getUserFollowingPosts(
      request.user.userId,
      Number(page),
      Number(limit),
    );
  }

  @Post('liked')
  @SkipThrottle()
  async getUserLikedPostIds(
    @Req() req: AuthRequest,
    @Body('postIds') postIds: number[],
  ) {
    return this.postService.getUserLikedPostIds(req.user.userId, postIds);
  }

  @Post('following')
  @SkipThrottle()
  async getUserFollowingIds(
    @Req() req: AuthRequest,
    @Body('userIds') userIds: number[],
  ) {
    return this.postService.getUserFollowingIds(req.user.userId, userIds);
  }
}
