import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

/** Aligned with `LoanConfig` in `schema.prisma` — rates stored as % per period (0–999.99). */
export class UpsertLoanConfigDto {
  @ApiProperty({ example: 5.0, description: 'Interest % per period (0–999.99).' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(999.99)
  interestRate!: number;

  @ApiProperty({ example: 30, description: 'Full repayment term in days.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  repaymentPeriodDays!: number;

  @ApiProperty({ example: false, description: 'Allow loans above the member’s contribution.' })
  @IsBoolean()
  allowExceedContribution!: boolean;

  @ApiPropertyOptional({
    example: 2.5,
    description:
      'Max loan as multiple of contribution; omit when not limiting (nullable in DB).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(999.99)
  maxLoanMultiplier?: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  allowPartialPayments!: boolean;

  @ApiPropertyOptional({
    example: 1.5,
    description: 'Penalty % per period when overdue; omit to disable (nullable in DB).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(999.99)
  penaltyRate?: number;

  @ApiProperty({ example: 7, description: 'Days after due before penalties apply.' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  gracePeriodDays!: number;
}
