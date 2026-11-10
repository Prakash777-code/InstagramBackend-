import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class SearchUserDto {
  @IsString()
  @IsNotEmpty()
  query: string;

  @IsNumber()
  @IsNotEmpty()
  page: number;

  @IsNumber()
  @IsNotEmpty()
  limit: number;
}
