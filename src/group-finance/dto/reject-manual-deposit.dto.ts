import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RejectManualDepositDto {
  @ApiPropertyOptional({
    description:
      'Optional message to the member (included in their rejection email and in super admin audit email).',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  reason?: string;
}
