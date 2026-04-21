import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CompletePasswordResetDto {
  @ApiProperty({
    description: 'Token from POST /auth/reset-password/verify-otp',
  })
  @IsString()
  @MinLength(10)
  resetToken!: string;

  @ApiProperty({ example: 'NewPassword123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
