import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: payload.userId,
      },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    if (user.sessionVersion != payload.sessionVersion) {
      console.log('SESSION VERSION DID NOT MATCHED ');
      throw new UnauthorizedException();
    }
    return {
      userId: payload.userId,
    };
  }
}
