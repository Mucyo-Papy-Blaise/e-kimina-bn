import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';

export class GroupMembershipDto {
  @ApiProperty()
  groupId!: string;

  @ApiProperty()
  groupName!: string;

  @ApiProperty({ enum: RoleName })
  role!: RoleName;
}

export class UserResponseDto {
  @ApiProperty({ example: 'cm9w5y2k10000l9b0xj3u6q7r' })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: 'Aline Uwase' })
  fullName!: string;

  @ApiPropertyOptional({ example: '+250788000000', nullable: true })
  phoneNumber!: string | null;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/u/1.jpg', nullable: true })
  image!: string | null;

  @ApiProperty({
    enum: RoleName,
    example: RoleName.USER,
    description:
      'Platform scope from `UserPlatformRole`. Defaults to `USER`; `SUPER_ADMIN` is elevated. ' +
      'Group roles (MEMBER, GROUP_ADMIN, TREASURER) are in `groupMemberships`, not here.',
  })
  platformRole!: RoleName;

  @ApiProperty({
    type: [GroupMembershipDto],
    description:
      'Per-group roles from UserGroup (relational RBAC). Empty for platform-only users.',
  })
  groupMemberships!: GroupMembershipDto[];

  @ApiProperty({ example: '2026-04-16T08:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-04-16T08:00:00.000Z' })
  updatedAt!: Date;
}
