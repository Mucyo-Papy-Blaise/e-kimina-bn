import { ApiProperty } from '@nestjs/swagger';
import { DepositRecordStatus } from '@prisma/client';

export class MyPendingManualDepositItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() amount!: number;
  @ApiProperty() currency!: string;
  @ApiProperty({ enum: DepositRecordStatus })
  status!: DepositRecordStatus;
  @ApiProperty() createdAt!: string;
}
