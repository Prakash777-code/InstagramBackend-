import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  providers: [PostsService],
  controllers: [PostsController],
  imports:[PrismaModule,CloudinaryModule,JwtModule.register({
    secret: process.env.JWT_SECRET,
  })]
})
export class PostsModule {}
