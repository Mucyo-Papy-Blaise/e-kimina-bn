import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

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

  @ApiPropertyOptional({
    example: true,
    description:
      'If true, the group appears in the public directory and users can self-join.',
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiProperty({
    example: 50,
    description: 'Maximum members allowed in this group (not stored count).',
  })
  @IsInt()
  @Min(2)
  maxMembers!: number;

  @ApiPropertyOptional({
    example: 'treasurer@example.com',
    description:
      'Registered user email to assign as TREASURER for this group (must not be the creator).',
  })
  @IsOptional()
  @IsEmail()
  treasurerEmail?: string;
}
