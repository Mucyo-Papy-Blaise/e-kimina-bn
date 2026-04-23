import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

/** `userId` filter is only applied for `GROUP_ADMIN` and `TREASURER`. */
export class ListContributionsQueryDto {
  @ApiPropertyOptional({
    description: 'Optional member filter (admins and treasurers only)',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  userId?: string;
}
