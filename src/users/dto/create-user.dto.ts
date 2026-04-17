import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Aline Uwase' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  fullName!: string;

  @ApiPropertyOptional({ example: '+250788000000' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/u/1.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  image?: string;
}
