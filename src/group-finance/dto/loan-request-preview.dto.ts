import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoanRequestPreviewResponseDto {
  @ApiProperty()
  configured!: boolean;

  @ApiPropertyOptional()
  message?: string;

  @ApiPropertyOptional()
  canRequest?: boolean;

  @ApiPropertyOptional()
  currency?: string;

  @ApiPropertyOptional({ type: Number, description: 'Max amount this member may request' })
  maxAmount?: number;

  @ApiPropertyOptional({ type: Number, description: 'Min request amount' })
  minAmount?: number;

  @ApiPropertyOptional({ type: Number, description: 'Total contributions recorded as PAID' })
  totalContributed?: number;

  @ApiPropertyOptional({ type: Number, description: 'From loan config' })
  interestRate?: number;

  @ApiPropertyOptional()
  repaymentPeriodDays?: number;

  @ApiPropertyOptional()
  allowExceedContribution?: boolean;
}
