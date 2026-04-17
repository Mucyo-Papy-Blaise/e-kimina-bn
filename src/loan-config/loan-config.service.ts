import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

    const membership = await this.prisma.userGroup.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId,
        },
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
      throw new NotFoundException('Loan configuration has not been set up yet.');
    }

    return this.toResponse(config);
  }

  async upsertForGroupAdminOrTreasurer(
    userId: string,
    groupId: string,
    dto: UpsertLoanConfigDto,
  ) {
    await this.groupsService.assertUserCanAccessLoanConfig(userId, groupId);

    const config = await this.prisma.loanConfig.upsert({
      where: { groupId },
      create: {
        groupId,
        interestRate: new Prisma.Decimal(dto.interestRate),
        maxLoanAmount: new Prisma.Decimal(dto.maxLoanAmount),
        repaymentPeriodDays: dto.repaymentPeriodDays,
        penaltyRate: new Prisma.Decimal(dto.penaltyRate),
        allowPartialPayments: dto.allowPartialPayments,
      },
      update: {
        interestRate: new Prisma.Decimal(dto.interestRate),
        maxLoanAmount: new Prisma.Decimal(dto.maxLoanAmount),
        repaymentPeriodDays: dto.repaymentPeriodDays,
        penaltyRate: new Prisma.Decimal(dto.penaltyRate),
        allowPartialPayments: dto.allowPartialPayments,
      },
    });

    return this.toResponse(config);
  }

  private toResponse(config: {
    id: string;
    groupId: string;
    interestRate: Prisma.Decimal;
    maxLoanAmount: Prisma.Decimal;
    repaymentPeriodDays: number;
    penaltyRate: Prisma.Decimal;
    allowPartialPayments: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: config.id,
      groupId: config.groupId,
      interestRate: decimalToNumber(config.interestRate),
      maxLoanAmount: decimalToNumber(config.maxLoanAmount),
      repaymentPeriodDays: config.repaymentPeriodDays,
      penaltyRate: decimalToNumber(config.penaltyRate),
      allowPartialPayments: config.allowPartialPayments,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }
}
