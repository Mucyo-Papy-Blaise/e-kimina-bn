import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RoleName } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { CreateGroupDto } from './dto/create-group.dto';

const groupSelect = {
  id: true,
  name: true,
  description: true,
  isPublic: true,
  createdById: true,
  isVerified: true,
  maxMembers: true,
  createdAt: true,
} satisfies Prisma.GroupSelect;

export type GroupSummary = Prisma.GroupGetPayload<{
  select: typeof groupSelect;
}>;

export type GroupListFilter = {
  /** Groups created by the current user (any visibility). */
  view?: 'mine' | 'discover';
  /** Legacy: `?publicOnly=true` without `view` — all public groups. */
  legacyPublicOnly?: boolean;
};

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rolesService: RolesService,
  ) {}

  async create(
    userId: string,
    dto: CreateGroupDto,
  ): Promise<GroupSummary & { memberCount: number }> {
    const groupAdminRoleId = await this.rolesService.getRoleId(
      RoleName.GROUP_ADMIN,
    );
    const treasurerRoleId = await this.rolesService.getRoleId(
      RoleName.TREASURER,
    );

    const rawTreasurer = dto.treasurerEmail?.trim();
    let treasurerUserId: string | undefined;

    if (rawTreasurer) {
      const treasurer = await this.prisma.user.findUnique({
        where: { email: rawTreasurer.toLowerCase() },
      });

      if (!treasurer) {
        throw new BadRequestException(
          `No registered account for ${rawTreasurer}. Ask them to sign up first.`,
        );
      }

      if (treasurer.id === userId) {
        throw new BadRequestException(
          'Pick someone else as treasurer — you are already the group admin.',
        );
      }

      treasurerUserId = treasurer.id;
    }

    const seatsNeeded = 1 + (treasurerUserId ? 1 : 0);
    if (dto.maxMembers < seatsNeeded) {
      throw new BadRequestException(
        `Max members must be at least ${seatsNeeded} (admin${treasurerUserId ? ' + treasurer' : ''}).`,
      );
    }

    const group = await this.prisma.$transaction(async (tx) => {
      const created = await tx.group.create({
        data: {
          name: dto.name,
          description: dto.description,
          createdById: userId,
          maxMembers: dto.maxMembers,
          isPublic: dto.isPublic,
        },
        select: groupSelect,
      });

      await tx.userGroup.create({
        data: {
          userId,
          groupId: created.id,
          roleId: groupAdminRoleId,
        },
      });

      if (treasurerUserId) {
        await tx.userGroup.create({
          data: {
            userId: treasurerUserId,
            groupId: created.id,
            roleId: treasurerRoleId,
          },
        });
      }

      return created;
    });

    const memberCount = await this.prisma.userGroup.count({
      where: { groupId: group.id },
    });

    return { ...group, memberCount };
  }

  async findAll(
    userId: string,
    filter: GroupListFilter = {},
  ): Promise<(GroupSummary & { memberCount: number })[]> {
    let where: Prisma.GroupWhereInput | undefined;

    if (filter.view === 'mine') {
      where = { createdById: userId };
    } else if (filter.view === 'discover') {
      where = {
        isPublic: true,
        createdById: { not: userId },
      };
    } else if (filter.legacyPublicOnly) {
      where = { isPublic: true };
    }

    const groups = await this.prisma.group.findMany({
      where,
      select: groupSelect,
      orderBy: { createdAt: 'desc' },
    });

    const counts = await this.prisma.userGroup.groupBy({
      by: ['groupId'],
      _count: { _all: true },
    });

    const countByGroupId = new Map(
      counts.map((row) => [row.groupId, row._count._all]),
    );

    return groups.map((group) => ({
      ...group,
      memberCount: countByGroupId.get(group.id) ?? 0,
    }));
  }

  async findOne(
    groupId: string,
  ): Promise<GroupSummary & { memberCount: number }> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: groupSelect,
    });

    if (!group) {
      throw new NotFoundException(`Group ${groupId} was not found.`);
    }

    const memberCount = await this.prisma.userGroup.count({
      where: { groupId },
    });

    return { ...group, memberCount };
  }

  async join(userId: string, groupId: string): Promise<void> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException(`Group ${groupId} was not found.`);
    }

    if (!group.isPublic) {
      throw new ForbiddenException(
        'This group is private. You cannot join without an invitation.',
      );
    }

    const existing = await this.prisma.userGroup.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('You are already a member of this group.');
    }

    const memberCount = await this.prisma.userGroup.count({
      where: { groupId },
    });

    if (memberCount >= group.maxMembers) {
      throw new BadRequestException('This group has reached its member limit.');
    }

    const memberRoleId = await this.rolesService.getRoleId(RoleName.MEMBER);

    await this.prisma.userGroup.create({
      data: {
        userId,
        groupId,
        roleId: memberRoleId,
      },
    });
  }

  async verifyGroup(groupId: string): Promise<GroupSummary> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: groupSelect,
    });

    if (!group) {
      throw new NotFoundException(`Group ${groupId} was not found.`);
    }

    return this.prisma.group.update({
      where: { id: groupId },
      data: { isVerified: true },
      select: groupSelect,
    });
  }

  async togglePublic(
    groupId: string,
    isPublic: boolean,
  ): Promise<GroupSummary> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: groupSelect,
    });

    if (!group) {
      throw new NotFoundException(`Group ${groupId} was not found.`);
    }

    return this.prisma.group.update({
      where: { id: groupId },
      data: { isPublic: isPublic },
      select: groupSelect,
    });
  }

  async assertUserCanAccessLoanConfig(userId: string, groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException(`Group ${groupId} was not found.`);
    }

    if (!group.isVerified) {
      throw new ForbiddenException(
        'Loan configuration is only available after the group is verified by a super admin.',
      );
    }

    const membership = await this.prisma.userGroup.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId,
        },
      },
      include: { role: true },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this group.');
    }

    const allowed = new Set<RoleName>([
      RoleName.GROUP_ADMIN,
      RoleName.TREASURER,
    ]);

    if (!allowed.has(membership.role.name)) {
      throw new ForbiddenException(
        'Only group admins and treasurers can configure loans for this group.',
      );
    }
  }
}
