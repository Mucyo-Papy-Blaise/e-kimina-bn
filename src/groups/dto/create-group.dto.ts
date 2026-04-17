import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateGroupDto {
  @ApiProperty({ example: 'Umurenge Savings Circle' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ example: 'Weekly contributions every Friday.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({
    example: 50,
    description: 'Maximum members allowed in this group (not stored count).',
  })
  @IsInt()
  @Min(2)
  maxMembers!: number;
}
