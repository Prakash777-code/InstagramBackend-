import { Body, Controller, Post } from '@nestjs/common';
import { RegisterDto } from './dtos/register.dto';
import { AuthService } from './auth.service';
import { LoginDto } from './dtos/login.dto';

@Controller('auth')
export class AuthController {

    constructor(private authService:AuthService){}

    @Post("register")
    async register(@Body() registerDto:RegisterDto){
        return this.authService.register(registerDto)
    }

    @Post("login")
    async login(@Body() loginDto:LoginDto){
        return this.authService.login(loginDto)
    }

    @Post("refresh")
    async refreshToken(@Body('refreshToken') refreshToken:string){
        return this.authService.refreshToken(refreshToken)
    }
}
