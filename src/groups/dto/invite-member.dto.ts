import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class InviteMemberDto {
  @ApiProperty({ example: 'member@example.com' })
  @IsString()
  @IsEmail()
  email!: string;
}
