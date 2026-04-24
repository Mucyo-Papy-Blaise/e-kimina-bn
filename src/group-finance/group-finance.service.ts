import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ContributionStatus,
  DepositPaymentMethod,
  DepositRecordStatus,
  GroupMembershipStatus,
  LoanApplicationStatus,
  Prisma,
  RoleName,
} from '@prisma/client';
import { EmailService } from '../email/email.service.js';
import { PrismaService } from '../prisma/prisma.service';
import { GroupLoansService } from './group-loans.service';

function decN(v: Prisma.Decimal | null | undefined): number {
  return v == null ? 0 : v.toNumber();
}

@Injectable()
export class GroupFinanceService {
  private readonly logger = new Logger(GroupFinanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly groupLoans: GroupLoansService,
  ) {}

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

  private async requireGroupAdminInVerifiedGroup(
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
        role: { name: RoleName.GROUP_ADMIN },
      },
      include: { role: true },
    });
    if (!membership) {
      throw new ForbiddenException(
        'Only a group admin can review or manage manual deposit verification for this group.',
      );
    }
    return { group, membership };
  }

  private async getGroupAdminEmailsForGroup(groupId: string): Promise<string[]> {
    const rows = await this.prisma.userGroup.findMany({
      where: {
        groupId,
        membershipStatus: GroupMembershipStatus.ACTIVE,
        role: { name: RoleName.GROUP_ADMIN },
      },
      include: { user: { select: { email: true, isActive: true } } },
    });
    return [
      ...new Set(
        rows
          .filter((r) => r.user.isActive)
          .map((r) => r.user.email.trim().toLowerCase()),
      ),
    ];
  }

  private async getGroupAdminEmailsForGroupExcluding(
    groupId: string,
    excludeUserId: string,
  ): Promise<string[]> {
    const rows = await this.prisma.userGroup.findMany({
      where: {
        groupId,
        userId: { not: excludeUserId },
        membershipStatus: GroupMembershipStatus.ACTIVE,
        role: { name: RoleName.GROUP_ADMIN },
      },
      include: { user: { select: { email: true, isActive: true } } },
    });
    return [
      ...new Set(
        rows
          .filter((r) => r.user.isActive)
          .map((r) => r.user.email.trim().toLowerCase()),
      ),
    ];
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
      proofImageUrl?: string;
      memberLoanId?: string;
    },
  ) {
    const { group } = await this.requireActiveMemberInVerifiedGroup(
      userId,
      groupId,
    );
    if (dto.memberLoanId?.trim()) {
      return this.createDepositForMemberLoan(
        userId,
        groupId,
        group,
        dto,
        dto.memberLoanId.trim(),
      );
    }

    if (dto.paymentMethod === DepositPaymentMethod.MANUAL_TRANSFER) {
      if (!dto.proofImageUrl?.trim()) {
        throw new BadRequestException(
          'Upload a payment proof (receipt or screenshot) and pass proofImageUrl for manual transfer.',
        );
      }
    }

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

    if (dto.paymentMethod === DepositPaymentMethod.MTN_MOMO) {
      const now = new Date();
      const created = await this.prisma.$transaction(async (tx) => {
        const rec = await tx.depositRecord.create({
          data: {
            userId,
            groupId,
            amount: new Prisma.Decimal(roundMoney(dto.amount)),
            currency,
            contributionPortion: new Prisma.Decimal(roundMoney(contribution)),
            finePortion: new Prisma.Decimal(roundMoney(fine)),
            installmentPortion: new Prisma.Decimal(roundMoney(installment)),
            paymentMethod: DepositPaymentMethod.MTN_MOMO,
            phone: dto.phone?.trim() || null,
            status: DepositRecordStatus.CONFIRMED,
            proofImageUrl: null,
            reviewedAt: now,
            reviewedByUserId: null,
          },
        });
        await this.applyDepositToContributions(tx, rec);
        return rec;
      });

      const member = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true, email: true },
      });
      if (member) {
        const amountText = decN(created.amount).toFixed(2);
        try {
          await this.emailService.sendManualDepositConfirmedEmail(member.email, {
            memberName: member.fullName,
            groupName: group.name,
            amount: amountText,
            currency: created.currency,
          });
        } catch (e) {
          this.logger.error(
            `Failed to send MTN MoMo deposit confirmation email: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
        }
      }

      return {
        id: created.id,
        message:
          'Your MTN MoMo payment was recorded and your contribution balance was updated.',
        amount: decN(created.amount),
        currency: created.currency,
        status: created.status,
      };
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
        paymentMethod: DepositPaymentMethod.MANUAL_TRANSFER,
        phone: null,
        status: DepositRecordStatus.PENDING_VERIFICATION,
        proofImageUrl: dto.proofImageUrl!.trim(),
      },
    });

    {
      const member = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true, email: true },
      });
      if (member) {
        const groupAdminEmails = await this.getGroupAdminEmailsForGroup(groupId);
        try {
          await this.emailService.sendManualDepositPendingToGroupAdmins(
            groupAdminEmails,
            {
              groupName: group.name,
              memberName: member.fullName,
              memberEmail: member.email,
              amount: decN(created.amount).toFixed(2),
              currency: created.currency,
              depositId: created.id,
              groupId: group.id,
            },
          );
        } catch (e) {
          this.logger.error(
            `Failed to email group admins about pending manual deposit: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
        }
      }
    }

    return {
      id: created.id,
      message:
        'Your payment proof was submitted. A group admin will review it and you will be notified by email.',
      amount: decN(created.amount),
      currency: created.currency,
      status: created.status,
    };
  }

  private async createDepositForMemberLoan(
    userId: string,
    groupId: string,
    group: { name: string; id: string },
    dto: {
      amount: number;
      paymentMethod: DepositPaymentMethod;
      phone?: string;
      proofImageUrl?: string;
    },
    memberLoanId: string,
  ) {
    await this.groupLoans.assertMemberLoanRepaymentAllowed(
      userId,
      groupId,
      memberLoanId,
      dto.amount,
    );
    const preview = await this.groupLoans.getLoanRepaymentPreviewForMember(
      userId,
      groupId,
      memberLoanId,
    );
    if (!preview.configured || !('total' in preview) || preview.total == null) {
      throw new BadRequestException(
        (preview as { message?: string }).message ?? 'Loan repayment is not available.',
      );
    }
    const total = (preview as { total: number }).total;
    const allowPartial =
      (preview as { allowPartialPayments?: boolean }).allowPartialPayments ?? true;
    const currency = (preview as { currency: string }).currency;

    if (dto.paymentMethod === DepositPaymentMethod.MANUAL_TRANSFER) {
      if (!dto.proofImageUrl?.trim()) {
        throw new BadRequestException(
          'Upload a payment proof (receipt or screenshot) and pass proofImageUrl for manual transfer.',
        );
      }
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

    const installment = total;

    if (dto.paymentMethod === DepositPaymentMethod.MTN_MOMO) {
      const now = new Date();
      const created = await this.prisma.$transaction(async (tx) => {
        const rec = await tx.depositRecord.create({
          data: {
            userId,
            groupId,
            memberLoanId,
            amount: new Prisma.Decimal(roundMoney(dto.amount)),
            currency,
            contributionPortion: new Prisma.Decimal(0),
            finePortion: new Prisma.Decimal(0),
            installmentPortion: new Prisma.Decimal(roundMoney(installment)),
            paymentMethod: DepositPaymentMethod.MTN_MOMO,
            phone: dto.phone?.trim() || null,
            status: DepositRecordStatus.CONFIRMED,
            proofImageUrl: null,
            reviewedAt: now,
            reviewedByUserId: null,
          },
        });
        await this.groupLoans.applyMemberLoanRepayment(tx, rec, memberLoanId);
        return rec;
      });

      const member = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true, email: true },
      });
      if (member) {
        try {
          await this.emailService.sendManualDepositConfirmedEmail(member.email, {
            memberName: member.fullName,
            groupName: group.name,
            amount: decN(created.amount).toFixed(2),
            currency: created.currency,
          });
        } catch (e) {
          this.logger.error(
            `Failed to send loan repayment confirmation email: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
        }
      }

      return {
        id: created.id,
        message:
          'Your MTN MoMo loan payment was recorded and your loan balance was updated.',
        amount: decN(created.amount),
        currency: created.currency,
        status: created.status,
      };
    }

    const created = await this.prisma.depositRecord.create({
      data: {
        userId,
        groupId,
        memberLoanId,
        amount: new Prisma.Decimal(roundMoney(dto.amount)),
        currency,
        contributionPortion: new Prisma.Decimal(0),
        finePortion: new Prisma.Decimal(0),
        installmentPortion: new Prisma.Decimal(roundMoney(installment)),
        paymentMethod: DepositPaymentMethod.MANUAL_TRANSFER,
        phone: null,
        status: DepositRecordStatus.PENDING_VERIFICATION,
        proofImageUrl: dto.proofImageUrl!.trim(),
      },
    });

    {
      const member = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true, email: true },
      });
      if (member) {
        const groupAdminEmails = await this.getGroupAdminEmailsForGroup(groupId);
        try {
          await this.emailService.sendManualDepositPendingToGroupAdmins(
            groupAdminEmails,
            {
              groupName: group.name,
              memberName: member.fullName,
              memberEmail: member.email,
              amount: decN(created.amount).toFixed(2),
              currency: created.currency,
              depositId: created.id,
              groupId: group.id,
            },
          );
        } catch (e) {
          this.logger.error(
            `Failed to email group admins about pending loan repayment: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
        }
      }
    }

    return {
      id: created.id,
      message:
        'Your loan repayment proof was submitted. A group admin will review it and apply it to your loan.',
      amount: decN(created.amount),
      currency: created.currency,
      status: created.status,
    };
  }

  /**
   * Current user’s manual bank transfers awaiting group admin proof review (read-only; any active member).
   * MTN MoMo is confirmed when recorded — it does not appear here.
   */
  async getMyPendingManualDeposits(userId: string, groupId: string) {
    await this.requireActiveMemberInVerifiedGroup(userId, groupId);
    const rows = await this.prisma.depositRecord.findMany({
      where: {
        userId,
        groupId,
        status: DepositRecordStatus.PENDING_VERIFICATION,
        paymentMethod: DepositPaymentMethod.MANUAL_TRANSFER,
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      amount: decN(r.amount),
      currency: r.currency,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async listPendingManualDeposits(adminUserId: string, groupId: string) {
    await this.requireGroupAdminInVerifiedGroup(adminUserId, groupId);
    const rows = await this.prisma.depositRecord.findMany({
      where: {
        groupId,
        status: DepositRecordStatus.PENDING_VERIFICATION,
        paymentMethod: DepositPaymentMethod.MANUAL_TRANSFER,
      },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
    });
    return rows
      .filter((r) => r.proofImageUrl)
      .map((r) => ({
        id: r.id,
        amount: decN(r.amount),
        currency: r.currency,
        paymentMethod: r.paymentMethod,
        proofImageUrl: r.proofImageUrl as string,
        createdAt: r.createdAt.toISOString(),
        member: {
          id: r.userId,
          fullName: r.user.fullName,
          email: r.user.email,
        },
      }));
  }

  async confirmManualDeposit(
    reviewerId: string,
    groupId: string,
    depositId: string,
  ) {
    const { group } = await this.requireGroupAdminInVerifiedGroup(
      reviewerId,
      groupId,
    );
    const deposit = await this.prisma.depositRecord.findFirst({
      where: { id: depositId, groupId },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
    });
    if (!deposit) {
      throw new NotFoundException('Deposit not found.');
    }
    if (deposit.status !== DepositRecordStatus.PENDING_VERIFICATION) {
      throw new BadRequestException('This deposit is not awaiting manual proof verification.');
    }
    if (deposit.paymentMethod !== DepositPaymentMethod.MANUAL_TRANSFER) {
      throw new BadRequestException('Only manual bank transfers are confirmed from this list.');
    }

    const reviewer = await this.prisma.user.findUnique({
      where: { id: reviewerId },
      select: { fullName: true },
    });

    await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.depositRecord.findFirst({
        where: {
          id: depositId,
          groupId,
          status: DepositRecordStatus.PENDING_VERIFICATION,
          paymentMethod: DepositPaymentMethod.MANUAL_TRANSFER,
        },
      });
      if (!fresh) {
        throw new NotFoundException('Deposit not found.');
      }
      if (fresh.memberLoanId) {
        await this.groupLoans.applyMemberLoanRepayment(
          tx,
          fresh,
          fresh.memberLoanId,
        );
      } else {
        await this.applyDepositToContributions(tx, fresh);
      }
      await tx.depositRecord.update({
        where: { id: depositId },
        data: {
          status: DepositRecordStatus.CONFIRMED,
          reviewedAt: new Date(),
          reviewedByUserId: reviewerId,
        },
      });
    });

    const amountText = decN(deposit.amount).toFixed(2);
    try {
      await this.emailService.sendManualDepositConfirmedEmail(deposit.user.email, {
        memberName: deposit.user.fullName,
        groupName: group.name,
        amount: amountText,
        currency: deposit.currency,
      });
    } catch (e) {
      this.logger.error(
        `Failed to send deposit confirmation email: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }

    const auditTo = await this.getGroupAdminEmailsForGroupExcluding(
      groupId,
      reviewerId,
    );
    try {
      await this.emailService.sendManualDepositAuditToGroupAdmins(auditTo, {
        groupName: group.name,
        kind: 'CONFIRMED',
        memberName: deposit.user.fullName,
        amount: amountText,
        currency: deposit.currency,
        depositId,
        reason: null,
        reviewerName: reviewer?.fullName ?? 'Group admin',
      });
    } catch (e) {
      this.logger.error(
        `Failed to send group admin audit (confirm): ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }

    return {
      id: depositId,
      status: 'CONFIRMED' as const,
      message:
        'Payment confirmed. The member was notified by email and their balance was updated.',
    };
  }

  async rejectManualDeposit(
    reviewerId: string,
    groupId: string,
    depositId: string,
    reason: string | undefined,
  ) {
    const { group } = await this.requireGroupAdminInVerifiedGroup(
      reviewerId,
      groupId,
    );
    const deposit = await this.prisma.depositRecord.findFirst({
      where: { id: depositId, groupId },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
    });
    if (!deposit) {
      throw new NotFoundException('Deposit not found.');
    }
    if (deposit.status !== DepositRecordStatus.PENDING_VERIFICATION) {
      throw new BadRequestException('This deposit is not awaiting manual proof verification.');
    }
    if (deposit.paymentMethod !== DepositPaymentMethod.MANUAL_TRANSFER) {
      throw new BadRequestException('Only manual bank transfers can be rejected from this list.');
    }

    const trimmed = reason?.trim() ?? null;
    const reviewer = await this.prisma.user.findUnique({
      where: { id: reviewerId },
      select: { fullName: true },
    });

    await this.prisma.depositRecord.update({
      where: { id: depositId },
      data: {
        status: DepositRecordStatus.REJECTED,
        reviewedAt: new Date(),
        reviewedByUserId: reviewerId,
        rejectionReason: trimmed,
      },
    });

    const amountText = decN(deposit.amount).toFixed(2);
    try {
      await this.emailService.sendManualDepositRejectedEmail(deposit.user.email, {
        memberName: deposit.user.fullName,
        groupName: group.name,
        amount: amountText,
        currency: deposit.currency,
        reason: trimmed,
      });
    } catch (e) {
      this.logger.error(
        `Failed to send manual deposit rejection email: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }

    const auditTo = await this.getGroupAdminEmailsForGroupExcluding(
      groupId,
      reviewerId,
    );
    try {
      await this.emailService.sendManualDepositAuditToGroupAdmins(auditTo, {
        groupName: group.name,
        kind: 'REJECTED',
        memberName: deposit.user.fullName,
        amount: amountText,
        currency: deposit.currency,
        depositId,
        reason: trimmed,
        reviewerName: reviewer?.fullName ?? 'Group admin',
      });
    } catch (e) {
      this.logger.error(
        `Failed to send group admin audit (reject): ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }

    return {
      id: depositId,
      status: 'REJECTED' as const,
      message: 'Payment rejected. The member was notified by email.',
    };
  }

  private async applyDepositToContributions(
    tx: Prisma.TransactionClient,
    deposit: {
      userId: string;
      groupId: string;
      amount: Prisma.Decimal;
      contributionPortion: Prisma.Decimal;
    },
  ) {
    const { userId, groupId } = deposit;
    const payTotal = decN(deposit.amount);
    if (payTotal < 0.01) {
      return;
    }

    const cc = await tx.contributionConfig.findUnique({
      where: { groupId },
    });
    if (!cc) {
      throw new BadRequestException('Contribution configuration is missing.');
    }

    const openRows = await tx.contribution.findMany({
      where: {
        userId,
        groupId,
        status: { in: [ContributionStatus.PENDING, ContributionStatus.LATE] },
      },
      orderBy: { dueDate: 'asc' },
    });

    const rate = cc.latePenaltyRate;
    const eps = 0.01;
    let remaining = roundMoney(payTotal);

    if (openRows.length === 0) {
      const c = decN(deposit.contributionPortion);
      if (c > 0.01) {
        const due = new Date();
        await tx.contribution.create({
          data: {
            userId,
            groupId,
            amount: new Prisma.Decimal(roundMoney(c)),
            dueDate: due,
            status: ContributionStatus.PAID,
            paidAt: new Date(),
          },
        });
      }
      return;
    }

    for (const row of openRows) {
      if (remaining < eps) {
        break;
      }
      const a = decN(row.amount);
      let need: number;
      if (row.status === ContributionStatus.LATE && rate != null) {
        need = a + a * (decN(rate) / 100);
      } else {
        need = a;
      }
      need = roundMoney(need);
      if (need - remaining > eps) {
        break;
      }
      await tx.contribution.update({
        where: { id: row.id },
        data: { status: ContributionStatus.PAID, paidAt: new Date() },
      });
      remaining = roundMoney(remaining - need);
    }
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
    const totalContributed = paid._sum.amount ? decN(paid._sum.amount) : 0;

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
      message:
        'Your loan request was submitted. Both the group admin and the treasurer must approve before it is disbursed.',
    };
  }
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
