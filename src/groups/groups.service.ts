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
  createdById: true,
  isVerified: true,
  maxMembers: true,
  createdAt: true,
} satisfies Prisma.GroupSelect;

export type GroupSummary = Prisma.GroupGetPayload<{ select: typeof groupSelect }>;

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

    const group = await this.prisma.$transaction(async (tx) => {
      const created = await tx.group.create({
        data: {
          name: dto.name,
          description: dto.description,
          createdById: userId,
          maxMembers: dto.maxMembers,
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

      return created;
    });

    const memberCount = await this.prisma.userGroup.count({
      where: { groupId: group.id },
    });

    return { ...group, memberCount };
  }

  async findAll(): Promise<(GroupSummary & { memberCount: number })[]> {
    const groups = await this.prisma.group.findMany({
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
