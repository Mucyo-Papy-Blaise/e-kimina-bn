import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContributionInterval,
  GroupMembershipStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GroupsService } from '../groups/groups.service';
import { UpsertContributionConfigDto } from './dto/upsert-contribution-config.dto';

function decimalToNumber(value: Prisma.Decimal): number {
  return value.toNumber();
}

@Injectable()
export class ContributionConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groupsService: GroupsService,
  ) {}

  /**
   * Returns `null` if no row exists yet. Requires an active membership and a verified group
   * (same visibility rules as loan config).
   */
  async getForMember(userId: string, groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException(`Group ${groupId} was not found.`);
    }

    const membership = await this.prisma.userGroup.findFirst({
      where: {
        userId,
        groupId,
        membershipStatus: GroupMembershipStatus.ACTIVE,
      },
    });

    if (
      !membership &&
      !(await this.groupsService.isPlatformSuperAdminUser(userId))
    ) {
      throw new ForbiddenException('You are not a member of this group.');
    }

    if (!group.isVerified) {
      throw new ForbiddenException(
        'Contribution configuration is only available after the group is verified.',
      );
    }

    const config = await this.prisma.contributionConfig.findUnique({
      where: { groupId },
    });

    if (!config) {
      return null;
    }

    return this.toResponse(config);
  }

  async upsertForGroupAdminOrTreasurer(
    userId: string,
    groupId: string,
    dto: UpsertContributionConfigDto,
  ) {
    await this.groupsService.assertUserCanAccessContributionConfig(
      userId,
      groupId,
    );

    const startDate = new Date(dto.startDate);
    if (Number.isNaN(startDate.getTime())) {
      throw new BadRequestException('Invalid startDate.');
    }

    const latePenalty =
      dto.latePenaltyRate != null
        ? new Prisma.Decimal(dto.latePenaltyRate)
        : null;

    const currency = (dto.currency ?? 'RWF').trim() || 'RWF';

    const dayOfWeek =
      dto.dayOfWeek !== undefined ? dto.dayOfWeek : null;
    const dayOfMonth =
      dto.dayOfMonth !== undefined ? dto.dayOfMonth : null;

    const config = await this.prisma.contributionConfig.upsert({
      where: { groupId },
      create: {
        groupId,
        amount: new Prisma.Decimal(dto.amount),
        currency,
        interval: dto.interval,
        startDate,
        dayOfWeek,
        dayOfMonth,
        allowPartialPayments: dto.allowPartialPayments,
        latePenaltyRate: latePenalty,
        gracePeriodDays: dto.gracePeriodDays,
      },
      update: {
        amount: new Prisma.Decimal(dto.amount),
        currency,
        interval: dto.interval,
        startDate,
        dayOfWeek,
        dayOfMonth,
        allowPartialPayments: dto.allowPartialPayments,
        latePenaltyRate: latePenalty,
        gracePeriodDays: dto.gracePeriodDays,
      },
    });

    return this.toResponse(config);
  }

  private toResponse(config: {
    id: string;
    groupId: string;
    amount: Prisma.Decimal;
    currency: string;
    interval: ContributionInterval;
    startDate: Date;
    dayOfWeek: number | null;
    dayOfMonth: number | null;
    allowPartialPayments: boolean;
    latePenaltyRate: Prisma.Decimal | null;
    gracePeriodDays: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: config.id,
      groupId: config.groupId,
      amount: decimalToNumber(config.amount),
      currency: config.currency,
      interval: config.interval,
      startDate: config.startDate,
      dayOfWeek: config.dayOfWeek,
      dayOfMonth: config.dayOfMonth,
      allowPartialPayments: config.allowPartialPayments,
      latePenaltyRate:
        config.latePenaltyRate == null
          ? null
          : decimalToNumber(config.latePenaltyRate),
      gracePeriodDays: config.gracePeriodDays,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }
}
