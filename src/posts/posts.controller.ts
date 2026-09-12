import {
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
    default:{
      limit:4,
      ttl:60000
    }
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
}
