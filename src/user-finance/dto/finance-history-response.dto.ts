import { ApiProperty } from '@nestjs/swagger';

export class FinanceHistoryItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() groupId!: string;
  @ApiProperty() groupName!: string;
  @ApiProperty({ description: "CONTRIBUTION | LOAN_REPAYMENT | PENALTY | DEPOSIT" })
  type!: string;
  @ApiProperty() amount!: number;
  @ApiProperty() currency!: string;
  @ApiProperty() date!: string;
  @ApiProperty() description!: string;
  @ApiProperty() isCredit!: boolean;
  @ApiProperty({ required: false, nullable: true })
  status?: string | null;
}

export class UserFinanceHistoryResponseDto {
  @ApiProperty({ type: [FinanceHistoryItemDto] })
  items!: FinanceHistoryItemDto[];

  @ApiProperty() totalItems!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() totalPages!: number;
}
