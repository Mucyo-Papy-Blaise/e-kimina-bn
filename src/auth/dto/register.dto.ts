import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'member@ekimina.rw' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'StrongPassword123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

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

  @ApiPropertyOptional({
    description:
      'Invitation token from email (treasurer or team member; completes a pending account).',
  })
  @IsOptional()
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  invitationToken?: string;
}
