import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContributionStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, ValidateIf } from 'class-validator';

export class UpdateContributionDto {
  @ApiPropertyOptional({ enum: ContributionStatus })
  @IsOptional()
  @IsEnum(ContributionStatus)
  status?: ContributionStatus;

  @ApiPropertyOptional({
    description:
      'When payment was received. For `PAID`, if omitted the server uses the current time; `null` is treated as “use now” when status is PAID. Non-PAID statuses clear `paidAt`.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsDateString()
  paidAt?: string | null;
}
