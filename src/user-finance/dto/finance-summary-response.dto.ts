import { ApiProperty } from '@nestjs/swagger';

export class GroupBalanceItemDto {
  @ApiProperty() groupId!: string;
  @ApiProperty() groupName!: string;
  @ApiProperty() totalContributed!: number;
  @ApiProperty() currency!: string;
  @ApiProperty() memberSince!: string;
}

export class PenaltyBalanceItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() groupId!: string;
  @ApiProperty() groupName!: string;
  @ApiProperty() amount!: number;
  @ApiProperty() currency!: string;
  @ApiProperty() reason!: string;
  @ApiProperty() dueDate!: string;
}

export class UserFinanceSummaryResponseDto {
  @ApiProperty({ type: [GroupBalanceItemDto] })
  groupBalances!: GroupBalanceItemDto[];

  @ApiProperty({ type: [PenaltyBalanceItemDto] })
  penaltyBalances!: PenaltyBalanceItemDto[];
}
