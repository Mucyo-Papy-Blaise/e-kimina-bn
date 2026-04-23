import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContributionInterval } from '@prisma/client';

export class ContributionConfigResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  groupId!: string;

  @ApiProperty({ type: Number, description: 'Expected contribution amount' })
  amount!: number;

  @ApiProperty({ example: 'RWF' })
  currency!: string;

  @ApiProperty({ enum: ContributionInterval })
  interval!: ContributionInterval;

  @ApiProperty({ type: String, format: 'date-time' })
  startDate!: Date;

  @ApiPropertyOptional({ type: Number, nullable: true, description: '0–6 for weekly / biweekly' })
  dayOfWeek!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, description: '1–31 for monthly' })
  dayOfMonth!: number | null;

  @ApiProperty()
  allowPartialPayments!: boolean;

  @ApiPropertyOptional({ type: Number, nullable: true, description: 'Late penalty % per period' })
  latePenaltyRate!: number | null;

  @ApiProperty()
  gracePeriodDays!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
