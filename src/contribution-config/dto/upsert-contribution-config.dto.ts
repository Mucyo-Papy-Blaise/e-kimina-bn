import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContributionInterval } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Aligned with `ContributionConfig` in `schema.prisma`. */
export class UpsertContributionConfigDto {
  @ApiProperty({ example: 5000, description: 'Amount per contribution period' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ example: 'RWF', default: 'RWF' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @ApiProperty({ enum: ContributionInterval })
  @IsEnum(ContributionInterval)
  interval!: ContributionInterval;

  @ApiProperty({ description: 'When the schedule starts (ISO 8601)' })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({ description: '0 = Sunday … 6 = Saturday (weekly / biweekly)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @ApiPropertyOptional({ description: 'Day of month for monthly interval (1–31)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  dayOfMonth?: number;

  @ApiProperty({ example: false })
  @IsBoolean()
  allowPartialPayments!: boolean;

  @ApiPropertyOptional({
    description: 'Late penalty % per period; omit to disable',
    example: 2.5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(999.99)
  latePenaltyRate?: number;

  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  gracePeriodDays!: number;
}
