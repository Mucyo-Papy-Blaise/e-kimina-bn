import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  Max,
  Min,
} from 'class-validator';

export class UpsertLoanConfigDto {
  @ApiProperty({ example: 0.05, description: 'Annual or per-period rate as a decimal (e.g. 0.05 = 5%).' })
  @IsNumber()
  @Min(0)
  @Max(1)
  interestRate!: number;

  @ApiProperty({ example: 500000 })
  @IsNumber()
  @Min(0)
  maxLoanAmount!: number;

  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(1)
  repaymentPeriodDays!: number;

  @ApiProperty({ example: 0.02 })
  @IsNumber()
  @Min(0)
  @Max(1)
  penaltyRate!: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  allowPartialPayments!: boolean;
}
