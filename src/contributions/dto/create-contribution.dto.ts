import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContributionStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/** Creates one scheduled / recorded contribution row. Admin or treasurer only. */
export class CreateContributionDto {
  @ApiProperty({ description: 'Member user id (must be an active member of the group)' })
  @IsString()
  userId!: string;

  @ApiProperty({ example: 5000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ description: 'When this contribution is due (ISO 8601). Must be unique per member per group.' })
  @IsDateString()
  dueDate!: string;

  @ApiPropertyOptional({ enum: ContributionStatus, default: ContributionStatus.PENDING })
  @IsOptional()
  @IsEnum(ContributionStatus)
  status?: ContributionStatus;
}
