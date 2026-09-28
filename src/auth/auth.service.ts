import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dtos/register.dto';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dtos/login.dto';
import { jwtPayload } from './interfaces/jwtPayload';
import { JwtService } from '@nestjs/jwt';
import { checkPassword } from './helper/password.helper';
import { UpdatePassword } from './dtos/update.password.dto';
import { use } from 'passport';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}
  readonly CURRENT_PASSWORD_VERSION = 2;
  async register(registerDto: RegisterDto) {
    const { name, email, password } = registerDto;
    const exists = await this.prisma.user.findUnique({
      where: {
        email: email,
      },
    });
    if (exists) {
      throw new BadRequestException('Email already exists');
    }
    const existsName = await this.prisma.user.findUnique({
      where: {
        name: name,
      },
    });
    if (existsName) {
      throw new BadRequestException('Username already exists');
    }
    const passwordError = checkPassword(password);
    if (passwordError != null) {
      throw new BadRequestException(passwordError);
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        passwordVersion: 2,
      },
    });
    return {
      message: 'User registered',
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const user = await this.prisma.user.findUnique({
      where: {
        email: email,
      },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const payload: jwtPayload = {
      userId: user.id,
    };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '5m',
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });
    if (user.passwordVersion < this.CURRENT_PASSWORD_VERSION) {
      return {
        refreshToken: refreshToken,
        passwordChangeRequired: true,
      };
    }
    return {
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is missing');
    }
    let payload: jwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<jwtPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch (error) {
      console.log(error);
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.prisma.user.findUnique({
      where: {
        id: payload.userId,
      },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (user.passwordVersion < this.CURRENT_PASSWORD_VERSION) {
      throw new ForbiddenException('Password change is required to continue');
    }
    const newAccessToken = await this.jwtService.signAsync(
      {
        userId: payload.userId,
      },
      {
        secret: process.env.JWT_SECRET,
        expiresIn: '5m',
      },
    );
    return {
      accessToken: newAccessToken,
    };
  }

  async updatePassword(updatePasswordDto: UpdatePassword) {
    const { currentPassword, newPassword, refreshToken } = updatePasswordDto;
    let payload: jwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<jwtPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch (e) {
      console.log(e);
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.prisma.user.findUnique({
      where: {
        id: payload.userId,
      },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      throw new UnauthorizedException('Invalid current password');
    }
    const passwordError = checkPassword(newPassword);
    if (passwordError != null) {
      throw new BadRequestException(passwordError);
    }
    const hashPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: {
        id: payload.userId,
      },
      data: {
        password: hashPassword,
        passwordVersion: {
          increment: 1,
        },
      },
    });
    return {
      message: 'Password updated successfully',
    };
  }
}
