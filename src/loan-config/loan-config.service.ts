import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GroupMembershipStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GroupsService } from '../groups/groups.service';
import { UpsertLoanConfigDto } from './dto/upsert-loan-config.dto';

function decimalToNumber(value: Prisma.Decimal): number {
  return value.toNumber();
}

@Injectable()
export class LoanConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groupsService: GroupsService,
  ) {}

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

    if (!membership) {
      throw new ForbiddenException('You are not a member of this group.');
    }

    if (!group.isVerified) {
      throw new ForbiddenException(
        'Loan configuration is only available after the group is verified.',
      );
    }

    const config = await this.prisma.loanConfig.findUnique({
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
    dto: UpsertLoanConfigDto,
  ) {
    await this.groupsService.assertUserCanAccessLoanConfig(userId, groupId);

    const maxLoan =
      dto.maxLoanMultiplier != null
        ? new Prisma.Decimal(dto.maxLoanMultiplier)
        : null;
    const penalty =
      dto.penaltyRate != null ? new Prisma.Decimal(dto.penaltyRate) : null;

    const config = await this.prisma.loanConfig.upsert({
      where: { groupId },
      create: {
        groupId,
        interestRate: new Prisma.Decimal(dto.interestRate),
        repaymentPeriodDays: dto.repaymentPeriodDays,
        allowExceedContribution: dto.allowExceedContribution,
        maxLoanMultiplier: maxLoan,
        allowPartialPayments: dto.allowPartialPayments,
        penaltyRate: penalty,
        gracePeriodDays: dto.gracePeriodDays,
      },
      update: {
        interestRate: new Prisma.Decimal(dto.interestRate),
        repaymentPeriodDays: dto.repaymentPeriodDays,
        allowExceedContribution: dto.allowExceedContribution,
        maxLoanMultiplier: maxLoan,
        allowPartialPayments: dto.allowPartialPayments,
        penaltyRate: penalty,
        gracePeriodDays: dto.gracePeriodDays,
      },
    });

    return this.toResponse(config);
  }

  private toResponse(config: {
    id: string;
    groupId: string;
    interestRate: Prisma.Decimal;
    repaymentPeriodDays: number;
    allowExceedContribution: boolean;
    maxLoanMultiplier: Prisma.Decimal | null;
    allowPartialPayments: boolean;
    penaltyRate: Prisma.Decimal | null;
    gracePeriodDays: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: config.id,
      groupId: config.groupId,
      interestRate: decimalToNumber(config.interestRate),
      repaymentPeriodDays: config.repaymentPeriodDays,
      allowExceedContribution: config.allowExceedContribution,
      maxLoanMultiplier:
        config.maxLoanMultiplier == null
          ? null
          : decimalToNumber(config.maxLoanMultiplier),
      allowPartialPayments: config.allowPartialPayments,
      penaltyRate:
        config.penaltyRate == null ? null : decimalToNumber(config.penaltyRate),
      gracePeriodDays: config.gracePeriodDays,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }
}
