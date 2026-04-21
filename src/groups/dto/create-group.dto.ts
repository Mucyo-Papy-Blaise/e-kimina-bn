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
    example: false,
    description:
      'If true, the group appears in the public directory and users can self-join. Defaults to false until public groups are finalized.',
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
  minMembers!: number;

  @ApiPropertyOptional({
    example: 'treasurer@example.com',
    description:
      'Treasurer email. If they already have an active account, they are added as TREASURER. Otherwise a pending user is created and an invitation email is sent (must not be the creator).',
  })
  @IsOptional()
  @IsEmail()
  treasurerEmail?: string;
}
