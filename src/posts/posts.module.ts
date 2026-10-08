import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { JwtModule } from '@nestjs/jwt';
import { FirebaseService } from '../services/firebase.service';
import { Helper } from './utils/helper';

@Module({
  providers: [PostsService, FirebaseService, Helper],
  controllers: [PostsController],
  imports:[PrismaModule,CloudinaryModule,JwtModule.register({
    secret: process.env.JWT_SECRET,
  })]
})
export class PostsModule {}
