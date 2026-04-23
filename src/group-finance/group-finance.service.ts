import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContributionStatus,
  DepositPaymentMethod,
  GroupMembershipStatus,
  LoanApplicationStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function decN(v: Prisma.Decimal | null | undefined): number {
  return v == null ? 0 : v.toNumber();
}

@Injectable()
export class GroupFinanceService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireActiveMemberInVerifiedGroup(
    userId: string,
    groupId: string,
  ) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });
    if (!group) {
      throw new NotFoundException(`Group ${groupId} was not found.`);
    }
    if (!group.isVerified) {
      throw new ForbiddenException(
        'This action is only available for verified groups.',
      );
    }
    const membership = await this.prisma.userGroup.findFirst({
      where: {
        userId,
        groupId,
        membershipStatus: GroupMembershipStatus.ACTIVE,
      },
    });
    if (!membership) {
      throw new ForbiddenException('You are not an active member of this group.');
    }
    return { group, membership };
  }

  async getDepositPreview(userId: string, groupId: string) {
    await this.requireActiveMemberInVerifiedGroup(userId, groupId);

    const cc = await this.prisma.contributionConfig.findUnique({
      where: { groupId },
    });

    if (!cc) {
      return {
        configured: false,
        message: 'Contribution rules are not configured for this group yet.',
      };
    }

    const currency = cc.currency ?? 'RWF';
    const allowPartial = cc.allowPartialPayments;
    const rate = cc.latePenaltyRate;

    const openRows = await this.prisma.contribution.findMany({
      where: {
        userId,
        groupId,
        status: { in: [ContributionStatus.PENDING, ContributionStatus.LATE] },
      },
      orderBy: { dueDate: 'asc' },
    });

    let contribution = 0;
    let fine = 0;

    if (openRows.length === 0) {
      contribution = decN(cc.amount);
    } else {
      for (const row of openRows) {
        const a = decN(row.amount);
        if (row.status === ContributionStatus.PENDING) {
          contribution += a;
        } else {
          contribution += a;
          if (rate != null) {
            fine += a * (decN(rate) / 100);
          }
        }
      }
    }

    const installment = 0;
    const total = contribution + fine + installment;

    return {
      configured: true,
      currency,
      allowPartialPayments: allowPartial,
      contribution: roundMoney(contribution),
      fine: roundMoney(fine),
      installment: roundMoney(installment),
      total: roundMoney(total),
    };
  }

  async createDeposit(
    userId: string,
    groupId: string,
    dto: {
      amount: number;
      paymentMethod: DepositPaymentMethod;
      phone?: string;
    },
  ) {
    const { group } = await this.requireActiveMemberInVerifiedGroup(
      userId,
      groupId,
    );
    void group;

    const preview = await this.getDepositPreview(userId, groupId);

    if (!preview.configured || !('total' in preview) || preview.total == null) {
      throw new BadRequestException(
        'Deposits are not available until contribution rules are configured.',
      );
    }

    const total = preview.total;
    const allowPartial = preview.allowPartialPayments ?? false;
    const currency = preview.currency ?? 'RWF';
    const contribution = preview.contribution ?? 0;
    const fine = preview.fine ?? 0;
    const installment = preview.installment ?? 0;

    if (total <= 0) {
      throw new BadRequestException('Nothing to pay for this period.');
    }

    if (dto.paymentMethod === DepositPaymentMethod.MTN_MOMO) {
      if (!dto.phone?.trim()) {
        throw new BadRequestException('Phone number is required for MTN MoMo.');
      }
    }

    if (!allowPartial) {
      if (Math.abs(dto.amount - total) > 0.01) {
        throw new BadRequestException(
          `This group requires the full amount (${total.toFixed(2)} ${currency}).`,
        );
      }
    } else {
      if (dto.amount < 0.01 || dto.amount - total > 0.01) {
        throw new BadRequestException(
          `Amount must be between 0.01 and ${total.toFixed(2)} ${currency}.`,
        );
      }
    }

    const created = await this.prisma.depositRecord.create({
      data: {
        userId,
        groupId,
        amount: new Prisma.Decimal(roundMoney(dto.amount)),
        currency,
        contributionPortion: new Prisma.Decimal(roundMoney(contribution)),
        finePortion: new Prisma.Decimal(roundMoney(fine)),
        installmentPortion: new Prisma.Decimal(roundMoney(installment)),
        paymentMethod: dto.paymentMethod,
        phone: dto.phone?.trim() || null,
        status: 'PENDING',
      },
    });

    return {
      id: created.id,
      message:
        dto.paymentMethod === DepositPaymentMethod.MTN_MOMO
          ? 'Payment request recorded. You will receive a push prompt on your phone when the gateway is connected.'
          : 'Deposit recorded. Complete your bank transfer and notify your treasurer.',
      amount: decN(created.amount),
      currency: created.currency,
      status: created.status,
    };
  }

  async getLoanRequestPreview(userId: string, groupId: string) {
    await this.requireActiveMemberInVerifiedGroup(userId, groupId);

    const loanConfig = await this.prisma.loanConfig.findUnique({
      where: { groupId },
    });

    if (!loanConfig) {
      return {
        configured: false,
        message: 'Loan rules are not configured for this group yet.',
      };
    }

    const paid = await this.prisma.contribution.aggregate({
      where: {
        userId,
        groupId,
        status: ContributionStatus.PAID,
      },
      _sum: { amount: true },
    });
    const totalContributed = paid._sum.amount
      ? decN(paid._sum.amount)
      : 0;

    const allowExceed = loanConfig.allowExceedContribution;
    const mult = loanConfig.maxLoanMultiplier;
    const interestRate = decN(loanConfig.interestRate);
    const repaymentPeriodDays = loanConfig.repaymentPeriodDays;

    let maxAmount: number;
    if (!allowExceed) {
      maxAmount = totalContributed;
    } else if (mult != null) {
      maxAmount = totalContributed * decN(mult);
    } else {
      maxAmount = 999_999_999.99;
    }

    maxAmount = roundMoney(maxAmount);
    const canRequest = maxAmount > 0;

    return {
      configured: true,
      canRequest,
      currency: 'RWF',
      minAmount: 0.01,
      maxAmount,
      totalContributed: roundMoney(totalContributed),
      interestRate,
      repaymentPeriodDays,
      allowExceedContribution: allowExceed,
    };
  }

  async createLoanApplication(
    userId: string,
    groupId: string,
    requestedAmount: number,
  ) {
    await this.requireActiveMemberInVerifiedGroup(userId, groupId);

    const loanConfig = await this.prisma.loanConfig.findUnique({
      where: { groupId },
    });
    if (!loanConfig) {
      throw new BadRequestException('Loan is not configured for this group.');
    }

    const preview = await this.getLoanRequestPreview(userId, groupId);

    if (!preview.configured) {
      throw new BadRequestException('You cannot request a loan in this group yet.');
    }

    if (!preview.canRequest) {
      throw new BadRequestException(
        'You are not eligible to request a loan (max amount is 0). Contribute first.',
      );
    }

    const maxAmount = preview.maxAmount ?? 0;
    if (requestedAmount > maxAmount + 0.01) {
      throw new BadRequestException(
        `Requested amount must not exceed ${maxAmount.toFixed(2)} RWF for your current stake.`,
      );
    }

    const created = await this.prisma.loanApplication.create({
      data: {
        userId,
        groupId,
        requestedAmount: new Prisma.Decimal(roundMoney(requestedAmount)),
        status: LoanApplicationStatus.PENDING,
        interestRateSnapshot: loanConfig.interestRate,
        repaymentPeriodDaysSnapshot: loanConfig.repaymentPeriodDays,
        maxAmountSnapshot: new Prisma.Decimal(roundMoney(maxAmount)),
      },
    });

    return {
      id: created.id,
      status: created.status,
      requestedAmount: decN(created.requestedAmount),
      message: 'Your loan request was submitted. A group admin or treasurer will review it.',
    };
  }
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
