import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GroupResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty()
  createdById!: string;

  @ApiProperty()
  isVerified!: boolean;

  @ApiProperty()
  maxMembers!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional({
    description: 'Derived from UserGroup rows (not a stored column).',
  })
  memberCount?: number;
}
