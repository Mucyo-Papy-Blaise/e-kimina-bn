import { ApiProperty } from '@nestjs/swagger';

export class UpcomingPaymentItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() groupId!: string;
  @ApiProperty() groupName!: string;
  @ApiProperty() type!: string;
  @ApiProperty() amount!: number;
  @ApiProperty() currency!: string;
  @ApiProperty() dueDate!: string;
  @ApiProperty() description!: string;
  @ApiProperty() status!: string;
}

export class UserFinanceUpcomingResponseDto {
  @ApiProperty({ type: [UpcomingPaymentItemDto] })
  items!: UpcomingPaymentItemDto[];
}
