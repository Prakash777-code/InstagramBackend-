import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { PostsModule } from './posts/posts.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [AuthModule, PrismaModule, PostsModule, CloudinaryModule,CacheModule.register({
      isGlobal: true,
      ttl: 30 * 60 * 1000,
    }),ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 10,
        },
      ],
    }),],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
