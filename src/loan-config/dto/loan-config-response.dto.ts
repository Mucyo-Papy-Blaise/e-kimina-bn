import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoanConfigResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  groupId!: string;

  @ApiProperty({ type: Number, description: '% per period' })
  interestRate!: number;

  @ApiProperty()
  repaymentPeriodDays!: number;

  @ApiProperty()
  allowExceedContribution!: boolean;

  @ApiPropertyOptional({ type: Number, nullable: true, description: 'Optional cap as × contribution' })
  maxLoanMultiplier!: number | null;

  @ApiProperty()
  allowPartialPayments!: boolean;

  @ApiPropertyOptional({ type: Number, nullable: true, description: '% per period' })
  penaltyRate!: number | null;

  @ApiProperty()
  gracePeriodDays!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
