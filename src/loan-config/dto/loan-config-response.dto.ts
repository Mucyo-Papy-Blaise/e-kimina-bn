import { ApiProperty } from '@nestjs/swagger';

export class LoanConfigResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  groupId!: string;

  @ApiProperty({ type: Number })
  interestRate!: number;

  @ApiProperty({ type: Number })
  maxLoanAmount!: number;

  @ApiProperty()
  repaymentPeriodDays!: number;

  @ApiProperty({ type: Number })
  penaltyRate!: number;

  @ApiProperty()
  allowPartialPayments!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
