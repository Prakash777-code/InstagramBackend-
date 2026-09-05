import {
  Controller,
  Get,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import type { AuthRequest } from '../auth/interfaces/authRequest';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('posts')
@UseGuards(AuthGuard('jwt'))
export class PostsController {
  constructor(private postService: PostsService) {}

  @Post('upload')
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
  async getPosts() {
    return this.postService.getPosts();
  }

  @Get('user')
  async getPostsByUserId(@Req() request: AuthRequest) {
    return this.postService.getUserProfile(request.user.userId);
  }
}
