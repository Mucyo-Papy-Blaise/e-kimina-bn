import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'member@ekimina.rw' })
  @IsEmail()
  email!: string;
}
