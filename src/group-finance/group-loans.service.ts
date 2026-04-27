import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  GroupMembershipStatus,
  LoanApplicationStatus,
  MemberLoanStatus,
  Prisma,
  RoleName,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

function decN(v: Prisma.Decimal | null | undefined): number {
  return v == null ? 0 : v.toNumber();
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class GroupLoansService {
  private readonly logger = new Logger(GroupLoansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async requireVerifiedGroup(groupId: string) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException(`Group ${groupId} was not found.`);
    if (!group.isVerified) {
      throw new ForbiddenException('This action is only for verified groups.');
    }
    return group;
  }

  private async getActiveMembershipWithRole(userId: string, groupId: string) {
    const m = await this.prisma.userGroup.findFirst({
      where: {
        userId,
        groupId,
        membershipStatus: GroupMembershipStatus.ACTIVE,
      },
      include: { role: true },
    });
    if (!m) {
      throw new ForbiddenException('You are not an active member of this group.');
    }
    return m;
  }

  /** Group admin or treasurer, for review routes. */
  private async requireAdminOrTreasurer(userId: string, groupId: string) {
    await this.requireVerifiedGroup(groupId);
    const m = await this.getActiveMembershipWithRole(userId, groupId);
    if (m.role.name !== RoleName.GROUP_ADMIN && m.role.name !== RoleName.TREASURER) {
      throw new ForbiddenException(
        'Only a group admin or treasurer can review loan applications.',
      );
    }
    return m.role.name;
  }

  listLoanApplicationsForGroup(adminOrTreasurerId: string, groupId: string) {
    return this.listApplicationsInternal(adminOrTreasurerId, groupId);
  }

  private async listApplicationsInternal(reviewerId: string, groupId: string) {
    await this.requireAdminOrTreasurer(reviewerId, groupId);
    const apps = await this.prisma.loanApplication.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        group: { select: { id: true, name: true } },
        groupAdminApprovedBy: { select: { id: true, fullName: true } },
        treasurerApprovedBy: { select: { id: true, fullName: true } },
        rejectedBy: { select: { id: true, fullName: true } },
        memberLoan: { select: { id: true } },
      },
    });
    return apps.map((a) => this.toApplicationDto(a));
  }

  private toApplicationDto(
    a: Prisma.LoanApplicationGetPayload<{
      include: {
        user: { select: { id: true; fullName: true; email: true } };
        group: { select: { id: true; name: true } };
        groupAdminApprovedBy: { select: { id: true; fullName: true } };
        treasurerApprovedBy: { select: { id: true; fullName: true } };
        rejectedBy: { select: { id: true; fullName: true } };
        memberLoan: { select: { id: true } };
      };
    }>,
  ) {
    const gAdmin = a.groupAdminApprovedAt != null;
    const treas = a.treasurerApprovedAt != null;
    const needBoth = a.status === LoanApplicationStatus.PENDING;
    const waitingText = needBoth
      ? !gAdmin && !treas
        ? 'Group admin and treasurer'
        : gAdmin && !treas
          ? 'Treasurer'
          : !gAdmin && treas
            ? 'Group admin'
            : null
      : null;
    return {
      id: a.id,
      userId: a.userId,
      userName: a.user.fullName,
      userEmail: a.user.email,
      groupId: a.groupId,
      groupName: a.group.name,
      requestedAmount: decN(a.requestedAmount),
      currency: 'RWF',
      interestRate: decN(a.interestRateSnapshot),
      repaymentPeriodDays: a.repaymentPeriodDaysSnapshot,
      maxAmountAtRequest: a.maxAmountSnapshot != null ? decN(a.maxAmountSnapshot) : null,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
      groupAdminApproved: gAdmin,
      groupAdminApprovedAt: a.groupAdminApprovedAt?.toISOString() ?? null,
      groupAdminApprovedByName: a.groupAdminApprovedBy?.fullName ?? null,
      treasurerApproved: treas,
      treasurerApprovedAt: a.treasurerApprovedAt?.toISOString() ?? null,
      treasurerApprovedByName: a.treasurerApprovedBy?.fullName ?? null,
      waitingOn: waitingText,
      rejectionReason: a.rejectionReason,
      rejectedAt: a.rejectedAt?.toISOString() ?? null,
      memberLoanId: a.memberLoan?.id ?? null,
    };
  }

  async approveLoanApplication(approverId: string, groupId: string, applicationId: string) {
    const role = await this.requireAdminOrTreasurer(approverId, groupId);
    const isAdmin = role === RoleName.GROUP_ADMIN;
    const now = new Date();

    const out = await this.prisma.$transaction(async (tx) => {
      const app = await tx.loanApplication.findFirst({
        where: { id: applicationId, groupId },
      });
      if (!app) {
        throw new NotFoundException('Loan application not found.');
      }
      if (app.status !== LoanApplicationStatus.PENDING) {
        throw new BadRequestException('This application is no longer pending.');
      }
      if (app.userId === approverId) {
        throw new ForbiddenException('You cannot approve your own loan application.');
      }
      if (isAdmin && app.groupAdminApprovedAt) {
        return {
          applicationId: app.id,
          status: 'PENDING' as const,
          memberLoanId: null as string | null,
          message: 'Group admin approval was already on file.',
        };
      }
      if (!isAdmin && app.treasurerApprovedAt) {
        return {
          applicationId: app.id,
          status: 'PENDING' as const,
          memberLoanId: null as string | null,
          message: 'Treasurer approval was already on file.',
        };
      }

      await tx.loanApplication.update({
        where: { id: applicationId },
        data: isAdmin
          ? {
              groupAdminApprovedAt: now,
              groupAdminApprovedById: approverId,
            }
          : {
              treasurerApprovedAt: now,
              treasurerApprovedById: approverId,
            },
      });
      const after = await tx.loanApplication.findUnique({ where: { id: applicationId } });
      if (!after) throw new NotFoundException('Loan application not found.');

      const both =
        after.groupAdminApprovedAt != null && after.treasurerApprovedAt != null;
      if (both) {
        const p = decN(after.requestedAmount);
        const interestPct = decN(after.interestRateSnapshot);
        const totalRep = roundMoney(p * (1 + interestPct / 100));
        const due = new Date(after.createdAt);
        due.setDate(due.getDate() + after.repaymentPeriodDaysSnapshot);

        const loan = await tx.memberLoan.create({
          data: {
            userId: after.userId,
            groupId: after.groupId,
            applicationId: after.id,
            principalAmount: after.requestedAmount,
            totalRepayable: new Prisma.Decimal(totalRep),
            amountRepaid: new Prisma.Decimal(0),
            currency: 'RWF',
            interestRateSnapshot: after.interestRateSnapshot,
            repaymentPeriodDaysSnapshot: after.repaymentPeriodDaysSnapshot,
            disbursedAt: now,
            dueDate: due,
            status: MemberLoanStatus.ACTIVE,
          },
        });
        await tx.loanApplication.update({
          where: { id: applicationId },
          data: { status: LoanApplicationStatus.APPROVED },
        });
        return {
          applicationId: after.id,
          status: 'APPROVED' as const,
          memberLoanId: loan.id,
          message:
            'Both approvals received. The loan is disbursed and is now active for the member.',
        };
      }
      return {
        applicationId: after.id,
        status: 'PENDING' as const,
        memberLoanId: null,
        message: isAdmin
          ? 'Group admin approval recorded. Waiting for treasurer approval before the loan is disbursed.'
          : 'Treasurer approval recorded. Waiting for group admin approval before the loan is disbursed.',
      };
    });

    if (!out.message?.includes('already on file')) {
      const app = await this.prisma.loanApplication.findFirst({
        where: { id: out.applicationId, groupId },
        include: {
          user: { select: { fullName: true } },
          group: { select: { name: true } },
        },
      });
      if (app) {
        if (out.status === 'APPROVED' && out.memberLoanId) {
          void this.notifications
            .notifyLoanDisbursed({
              borrowerUserId: app.userId,
              groupId: app.groupId,
              groupName: app.group.name,
              amount: decN(app.requestedAmount).toFixed(0),
              memberLoanId: out.memberLoanId!,
            })
            .catch((e) => this.logger.error(e));
        } else if (out.status === 'PENDING' && out.memberLoanId == null) {
          void this.notifications
            .notifyLoanAwaitingOtherApprover({
              groupId: app.groupId,
              groupName: app.group.name,
              applicationId: app.id,
              applicantName: app.user.fullName,
              amount: decN(app.requestedAmount).toFixed(0),
              justApprovedRole: isAdmin ? 'GROUP_ADMIN' : 'TREASURER',
            })
            .catch((e) => this.logger.error(e));
        }
      }
    }

    return out;
  }

  async rejectLoanApplication(
    reviewerId: string,
    groupId: string,
    applicationId: string,
    reason: string | undefined,
  ) {
    await this.requireAdminOrTreasurer(reviewerId, groupId);
    const r = (reason ?? '').trim();
    if (r.length < 3) {
      throw new BadRequestException('Please provide a rejection reason (at least 3 characters).');
    }
    const app = await this.prisma.loanApplication.findFirst({
      where: { id: applicationId, groupId },
      include: { group: { select: { name: true } } },
    });
    if (!app) {
      throw new NotFoundException('Loan application not found.');
    }
    if (app.status !== LoanApplicationStatus.PENDING) {
      throw new BadRequestException('This application is not pending.');
    }
    if (app.userId === reviewerId) {
      throw new ForbiddenException('You cannot reject your own loan application.');
    }
    const now = new Date();
    await this.prisma.loanApplication.update({
      where: { id: applicationId },
      data: {
        status: LoanApplicationStatus.REJECTED,
        rejectionReason: r,
        rejectedAt: now,
        rejectedBy: { connect: { id: reviewerId } },
      },
    });
    void this.notifications
      .notifyLoanRejected({
        borrowerUserId: app.userId,
        groupId: app.groupId,
        groupName: app.group.name,
        reason: r,
      })
      .catch((e) => this.logger.error(e));
    return {
      applicationId,
      status: 'REJECTED' as const,
      message: 'The loan application was rejected.',
    };
  }

  listMemberLoansForGroup(reviewerId: string, groupId: string) {
    return this.listMemberLoansInternal(reviewerId, groupId);
  }

  private async listMemberLoansInternal(reviewerId: string, groupId: string) {
    await this.requireAdminOrTreasurer(reviewerId, groupId);
    const rows = await this.prisma.memberLoan.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        group: { select: { name: true } },
      },
    });
    return rows.map((l) => this.toMemberLoanDto(l));
  }

  private toMemberLoanDto(
    l: Prisma.MemberLoanGetPayload<{
      include: {
        user: { select: { id: true; fullName: true; email: true } };
        group: { select: { name: true } };
      };
    }>,
  ) {
    const total = decN(l.totalRepayable) + decN(l.penaltyAccrued);
    const repaid = decN(l.amountRepaid);
    const outstanding = roundMoney(Math.max(0, total - repaid));
    const now = new Date();
    const overdue = l.status === MemberLoanStatus.ACTIVE && l.dueDate < now && outstanding > 0.01;
    return {
      id: l.id,
      userId: l.userId,
      userName: l.user.fullName,
      userEmail: l.user.email,
      groupId: l.groupId,
      groupName: l.group.name,
      principal: decN(l.principalAmount),
      totalRepayable: decN(l.totalRepayable),
      amountRepaid: repaid,
      penaltyAccrued: decN(l.penaltyAccrued),
      outstanding,
      currency: l.currency,
      interestRate: decN(l.interestRateSnapshot),
      repaymentPeriodDays: l.repaymentPeriodDaysSnapshot,
      disbursedAt: l.disbursedAt.toISOString(),
      dueDate: l.dueDate.toISOString(),
      status: l.status,
      isOverdue: overdue,
    };
  }

  async getLoanRepaymentPreviewForMember(userId: string, groupId: string, memberLoanId: string) {
    await this.getActiveMembershipWithRole(userId, groupId);
    const loan = await this.prisma.memberLoan.findFirst({
      where: { id: memberLoanId, userId, groupId },
    });
    if (!loan) {
      throw new NotFoundException('Loan not found for this group.');
    }
    if (loan.status !== MemberLoanStatus.ACTIVE) {
      return {
        configured: false,
        message: 'This loan is not active; no repayment is due through this flow.',
      };
    }
    const total = decN(loan.totalRepayable) + decN(loan.penaltyAccrued);
    const repaid = decN(loan.amountRepaid);
    const remaining = roundMoney(Math.max(0, total - repaid));
    if (remaining < 0.01) {
      return {
        configured: false,
        message: 'This loan is already fully repaid.',
      };
    }
    const cc = await this.prisma.contributionConfig.findUnique({ where: { groupId } });
    const allowPartial = cc?.allowPartialPayments ?? true;
    return {
      configured: true,
      currency: loan.currency,
      allowPartialPayments: allowPartial,
      totalDue: remaining,
      principalPortion: 0,
      finePortion: 0,
      installmentPortion: remaining,
      total: remaining,
    };
  }

  async assertMemberLoanRepaymentAllowed(
    userId: string,
    groupId: string,
    memberLoanId: string,
    amount: number,
  ) {
    const preview = await this.getLoanRepaymentPreviewForMember(
      userId,
      groupId,
      memberLoanId,
    );
    if (!preview.configured || !('total' in preview) || preview.total == null) {
      throw new BadRequestException(
        (preview as { message?: string }).message ?? 'Repayment is not available.',
      );
    }
    const rem = (preview as { total: number }).total;
    const allowPartial = (preview as { allowPartialPayments?: boolean }).allowPartialPayments ?? true;
    if (allowPartial) {
      if (amount < 0.01 || amount - rem > 0.01) {
        throw new BadRequestException(
          `Amount must be between 0.01 and ${rem.toFixed(2)} ${(preview as { currency: string }).currency}.`,
        );
      }
    } else if (Math.abs(amount - rem) > 0.01) {
      throw new BadRequestException(
        `This group requires the full balance (${rem.toFixed(2)}).`,
      );
    }
  }

  async applyMemberLoanRepayment(
    tx: Prisma.TransactionClient,
    deposit: { amount: Prisma.Decimal; userId: string; groupId: string },
    memberLoanId: string,
  ) {
    const pay = decN(deposit.amount);
    if (pay < 0.01) return;
    const loan = await tx.memberLoan.findFirst({
      where: { id: memberLoanId, userId: deposit.userId, groupId: deposit.groupId },
    });
    if (!loan) {
      throw new BadRequestException('Member loan not found for this payment.');
    }
    if (loan.status !== MemberLoanStatus.ACTIVE) {
      throw new BadRequestException('This loan is not active.');
    }
    const totalRep = decN(loan.totalRepayable);
    let pen = decN(loan.penaltyAccrued);
    let repaid = decN(loan.amountRepaid);
    let rem = pay;
    if (pen > 0.01) {
      const toPen = roundMoney(Math.min(rem, pen));
      pen = roundMoney(pen - toPen);
      rem = roundMoney(rem - toPen);
    }
    if (rem > 0.01) {
      const cap = roundMoney(Math.max(0, totalRep - repaid));
      const add = roundMoney(Math.min(rem, cap));
      repaid = roundMoney(repaid + add);
    }
    const outstanding = roundMoney(Math.max(0, totalRep - repaid) + pen);
    const isRepaid = outstanding < 0.01;
    await tx.memberLoan.update({
      where: { id: memberLoanId },
      data: {
        penaltyAccrued: new Prisma.Decimal(pen),
        amountRepaid: new Prisma.Decimal(repaid),
        status: isRepaid ? MemberLoanStatus.REPAID : loan.status,
      },
    });
  }
}
