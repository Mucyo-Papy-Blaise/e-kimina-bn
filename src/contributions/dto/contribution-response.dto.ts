import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContributionStatus } from '@prisma/client';
import { ContributionUserSummaryDto } from './contribution-user-summary.dto';

export class ContributionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  groupId!: string;

  @ApiProperty({ type: Number })
  amount!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  dueDate!: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  paidAt!: Date | null;

  @ApiProperty({ enum: ContributionStatus })
  status!: ContributionStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: ContributionUserSummaryDto })
  user!: ContributionUserSummaryDto;
}
