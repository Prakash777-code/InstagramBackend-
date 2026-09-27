import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class UpdatePassword {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword!: string;

  @IsString()
  @IsNotEmpty()
  refreshToken!:string
}
