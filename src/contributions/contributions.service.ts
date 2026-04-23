import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContributionStatus,
  GroupMembershipStatus,
  Prisma,
  RoleName,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GroupsService } from '../groups/groups.service';
import { CreateContributionDto } from './dto/create-contribution.dto';
import { UpdateContributionDto } from './dto/update-contribution.dto';

function decimalToNumber(value: Prisma.Decimal): number {
  return value.toNumber();
}

const userSelect = {
  id: true,
  fullName: true,
  email: true,
} satisfies Prisma.UserSelect;

type ContributionWithUser = Prisma.ContributionGetPayload<{
  include: { user: { select: typeof userSelect } };
}>;

@Injectable()
export class ContributionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groupsService: GroupsService,
  ) {}

  private async requireVerifiedActiveMember(userId: string, groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException(`Group ${groupId} was not found.`);
    }

    if (!group.isVerified) {
      throw new ForbiddenException(
        'Contributions are only available after the group is verified.',
      );
    }

    const membership = await this.prisma.userGroup.findFirst({
      where: {
        userId,
        groupId,
        membershipStatus: GroupMembershipStatus.ACTIVE,
      },
      include: { role: true },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this group.');
    }

    return { group, membership };
  }

  private isAdminOrTreasurer(role: RoleName) {
    return role === RoleName.GROUP_ADMIN || role === RoleName.TREASURER;
  }

  async list(
    currentUserId: string,
    groupId: string,
    query: { userId?: string },
  ) {
    const { membership } = await this.requireVerifiedActiveMember(
      currentUserId,
      groupId,
    );

    const privileged = this.isAdminOrTreasurer(membership.role.name);

    const where: Prisma.ContributionWhereInput = { groupId };

    if (privileged) {
      if (query.userId) {
        where.userId = query.userId;
      }
    } else {
      where.userId = currentUserId;
    }

    const rows = await this.prisma.contribution.findMany({
      where,
      orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
      include: { user: { select: userSelect } },
    });

    return rows.map((r) => this.toResponse(r));
  }

  async getById(
    currentUserId: string,
    groupId: string,
    contributionId: string,
  ) {
    const { membership } = await this.requireVerifiedActiveMember(
      currentUserId,
      groupId,
    );

    const row = await this.prisma.contribution.findFirst({
      where: { id: contributionId, groupId },
      include: { user: { select: userSelect } },
    });

    if (!row) {
      throw new NotFoundException('Contribution not found.');
    }

    const privileged = this.isAdminOrTreasurer(membership.role.name);
    if (!privileged && row.userId !== currentUserId) {
      throw new ForbiddenException(
        'You can only view your own contributions in this group.',
      );
    }

    return this.toResponse(row);
  }

  async create(
    actorId: string,
    groupId: string,
    dto: CreateContributionDto,
  ) {
    await this.groupsService.assertUserCanAccessContributionConfig(
      actorId,
      groupId,
    );

    const targetMembership = await this.prisma.userGroup.findFirst({
      where: {
        userId: dto.userId,
        groupId,
        membershipStatus: GroupMembershipStatus.ACTIVE,
      },
    });

    if (!targetMembership) {
      throw new BadRequestException(
        'The target user is not an active member of this group.',
      );
    }

    const dueDate = new Date(dto.dueDate);
    if (Number.isNaN(dueDate.getTime())) {
      throw new BadRequestException('Invalid dueDate.');
    }

    const status = dto.status ?? ContributionStatus.PENDING;
    const paidAt =
      status === ContributionStatus.PAID ? new Date() : null;

    const created = await this.prisma.contribution.create({
      data: {
        userId: dto.userId,
        groupId,
        amount: new Prisma.Decimal(dto.amount),
        dueDate,
        status,
        paidAt,
      },
      include: { user: { select: userSelect } },
    });

    return this.toResponse(created);
  }

  async update(
    actorId: string,
    groupId: string,
    contributionId: string,
    dto: UpdateContributionDto,
  ) {
    await this.groupsService.assertUserCanAccessContributionConfig(
      actorId,
      groupId,
    );

    const existing = await this.prisma.contribution.findFirst({
      where: { id: contributionId, groupId },
    });

    if (!existing) {
      throw new NotFoundException('Contribution not found.');
    }

    let status = dto.status ?? existing.status;
    let paidAt: Date | null = existing.paidAt;

    if (dto.paidAt !== undefined) {
      if (dto.paidAt === null) {
        paidAt = null;
      } else {
        const d = new Date(dto.paidAt);
        if (Number.isNaN(d.getTime())) {
          throw new BadRequestException('Invalid paidAt.');
        }
        paidAt = d;
      }
    }

    if (status === ContributionStatus.PAID) {
      if (paidAt == null) {
        paidAt = new Date();
      }
    } else {
      paidAt = null;
    }

    const updated = await this.prisma.contribution.update({
      where: { id: contributionId },
      data: {
        status,
        paidAt,
      },
      include: { user: { select: userSelect } },
    });

    return this.toResponse(updated);
  }

  private toResponse(row: ContributionWithUser) {
    return {
      id: row.id,
      userId: row.userId,
      groupId: row.groupId,
      amount: decimalToNumber(row.amount),
      dueDate: row.dueDate,
      paidAt: row.paidAt,
      status: row.status,
      createdAt: row.createdAt,
      user: row.user,
    };
  }
}
