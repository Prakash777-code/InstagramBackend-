import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { RegisterDto } from './dtos/register.dto';
import { AuthService } from './auth.service';
import { LoginDto } from './dtos/login.dto';
import { Throttle } from '@nestjs/throttler';
import { UpdatePassword } from './dtos/update.password.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @Throttle({
    default: {
      limit: 5,
      ttl: 60000,
    },
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @Post('updatePassword')
  async updatePassword(@Body() updatePasswordDto: UpdatePassword) {
    return this.authService.updatePassword(updatePasswordDto);
  }
}
