import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DepositPreviewResponseDto {
  @ApiProperty({ description: 'Whether contribution rules exist for this group' })
  configured!: boolean;

  @ApiPropertyOptional()
  message?: string;

  @ApiPropertyOptional({ example: 'RWF' })
  currency?: string;

  @ApiPropertyOptional()
  allowPartialPayments?: boolean;

  @ApiPropertyOptional({ type: Number, description: 'Scheduled contribution(s) due' })
  contribution?: number;

  @ApiPropertyOptional({ type: Number, description: 'Late penalties' })
  fine?: number;

  @ApiPropertyOptional({ type: Number, description: 'Loan repayments (when loans exist)' })
  installment?: number;

  @ApiPropertyOptional({ type: Number, description: 'contribution + fine + installment' })
  total?: number;
}
