import { IsNotEmpty, IsString } from 'class-validator';

export class ResetDto {
  @IsString()
  @IsNotEmpty()
  resetToken: string;

  @IsString()
  @IsNotEmpty()
  newPassword: string;
}
