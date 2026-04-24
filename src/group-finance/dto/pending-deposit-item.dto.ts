import { ApiProperty } from '@nestjs/swagger';
import { DepositPaymentMethod } from '@prisma/client';

class PendingDepositMemberDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() email!: string;
}

export class PendingDepositItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() amount!: number;
  @ApiProperty() currency!: string;
  @ApiProperty({ enum: DepositPaymentMethod })
  paymentMethod!: DepositPaymentMethod;
  @ApiProperty({ description: 'URL of payment proof image' })
  proofImageUrl!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ type: PendingDepositMemberDto })
  member!: PendingDepositMemberDto;
}
