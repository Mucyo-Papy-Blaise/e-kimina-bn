import { Injectable } from '@nestjs/common';
import {
  ContributionStatus,
  DepositPaymentMethod,
  DepositRecordStatus,
  GroupMembershipStatus,
  LoanApplicationStatus,
  MemberLoanStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function dec(v: Prisma.Decimal | null | undefined): number {
  return v == null ? 0 : v.toNumber();
}

@Injectable()
export class UserFinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string) {
    const memberships = await this.prisma.userGroup.findMany({
      where: {
        userId,
        membershipStatus: GroupMembershipStatus.ACTIVE,
      },
      include: {
        group: {
          select: { id: true, name: true, isVerified: true },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    const verifiedGroupIds = memberships
      .filter((m) => m.group.isVerified)
      .map((m) => m.group.id);

    const groupBalances = await Promise.all(
      memberships
        .filter((m) => m.group.isVerified)
        .map(async (m) => {
          const cc = await this.prisma.contributionConfig.findUnique({
            where: { groupId: m.group.id },
          });
          const currency = cc?.currency ?? 'RWF';
          const paid = await this.prisma.contribution.aggregate({
            where: {
              userId,
              groupId: m.group.id,
              status: ContributionStatus.PAID,
            },
            _sum: { amount: true },
          });
          return {
            groupId: m.group.id,
            groupName: m.group.name,
            totalContributed: dec(paid._sum.amount),
            currency,
            memberSince: m.joinedAt.toISOString(),
          };
        }),
    );

    const lateRows =
      verifiedGroupIds.length === 0
        ? []
        : await this.prisma.contribution.findMany({
            where: {
              userId,
              groupId: { in: verifiedGroupIds },
              status: ContributionStatus.LATE,
            },
            include: {
              group: {
                select: {
                  id: true,
                  name: true,
                  contributionConfig: {
                    select: { currency: true, latePenaltyRate: true },
                  },
                },
              },
            },
          });

    const penaltyBalances: {
      id: string;
      groupId: string;
      groupName: string;
      amount: number;
      currency: string;
      reason: string;
      dueDate: string;
    }[] = [];

    for (const row of lateRows) {
      const rate = row.group.contributionConfig?.latePenaltyRate;
      const base = dec(row.amount);
      const fine = rate != null ? roundMoney(base * (dec(rate) / 100)) : 0;
      if (fine <= 0) continue;
      penaltyBalances.push({
        id: row.id,
        groupId: row.groupId,
        groupName: row.group.name,
        amount: fine,
        currency: row.group.contributionConfig?.currency ?? 'RWF',
        reason: `Late fee on contribution due ${row.dueDate.toISOString().slice(0, 10)}`,
        dueDate: row.dueDate.toISOString(),
      });
    }

    return { groupBalances, penaltyBalances };
  }

  async getHistory(userId: string, page: number, pageSize: number) {
    const p = Math.max(1, page);
    const ps = Math.min(100, Math.max(1, pageSize));
    const skip = (p - 1) * ps;

    const [countRow] = await this.prisma.$queryRaw<[{ c: bigint }]>(
      Prisma.sql`
        SELECT COUNT(*)::bigint AS c
        FROM (
          SELECT c.id
          FROM contributions c
          WHERE c."userId" = ${userId}
            AND c.status = 'PAID'::"ContributionStatus"
            AND c."paidAt" IS NOT NULL
          UNION ALL
          SELECT d.id
          FROM deposit_records d
          WHERE d."userId" = ${userId}
            AND d.status = 'CONFIRMED'::"DepositRecordStatus"
        ) AS t
      `,
    );

    const totalItems = Number(countRow?.c ?? 0n);
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / ps);

    const raw = await this.prisma.$queryRaw<
      {
        id: string;
        txType: string;
        eventAt: Date;
        amount: number;
        groupId: string;
        groupName: string;
        currency: string;
        description: string;
        isCredit: boolean;
      }[]
    >(
      Prisma.sql`
        SELECT * FROM (
          SELECT c.id,
                 'CONTRIBUTION'::text AS "txType",
                 c."paidAt" AS "eventAt",
                 (c.amount)::float AS amount,
                 c."groupId",
                 g.name AS "groupName",
                 COALESCE(cc.currency, 'RWF')::text AS currency,
                 'Contribution (paid)'::text AS description,
                 false AS "isCredit"
          FROM contributions c
          INNER JOIN groups g ON g.id = c."groupId"
          LEFT JOIN contribution_config cc ON cc."groupId" = c."groupId"
          WHERE c."userId" = ${userId}
            AND c.status = 'PAID'::"ContributionStatus"
            AND c."paidAt" IS NOT NULL
          UNION ALL
          SELECT d.id,
                 'DEPOSIT'::text AS "txType",
                 COALESCE(d."reviewedAt", d."createdAt") AS "eventAt",
                 (d.amount)::float AS amount,
                 d."groupId",
                 g2.name AS "groupName",
                 d.currency::text,
                 'Manual bank deposit (confirmed)'::text AS description,
                 false
          FROM deposit_records d
          INNER JOIN groups g2 ON g2.id = d."groupId"
          WHERE d."userId" = ${userId}
            AND d.status = 'CONFIRMED'::"DepositRecordStatus"
        ) AS u
        ORDER BY u."eventAt" DESC
        LIMIT ${ps} OFFSET ${skip}
      `,
    );

    const items = raw.map((r) => ({
      id: r.id,
      groupId: r.groupId,
      groupName: r.groupName,
      type: r.txType,
      amount: roundMoney(Number(r.amount)),
      currency: r.currency,
      date: new Date(r.eventAt).toISOString(),
      description: r.description,
      isCredit: r.isCredit,
      status: 'COMPLETED' as const,
    }));

    return {
      items,
      totalItems,
      page: p,
      pageSize: ps,
      totalPages,
    };
  }

  async getUpcoming(userId: string) {
    const memberships = await this.prisma.userGroup.findMany({
      where: {
        userId,
        membershipStatus: GroupMembershipStatus.ACTIVE,
      },
      include: { group: { select: { id: true, name: true, isVerified: true } } },
    });

    const groupIds = memberships.filter((m) => m.group.isVerified).map((m) => m.groupId);
    const nameByGid = new Map(memberships.map((m) => [m.groupId, m.group.name]));

    const openContributions =
      groupIds.length === 0
        ? []
        : await this.prisma.contribution.findMany({
            where: {
              userId,
              groupId: { in: groupIds },
              status: { in: [ContributionStatus.PENDING, ContributionStatus.LATE] },
            },
            orderBy: { dueDate: 'asc' },
          });

    const items: {
      id: string;
      groupId: string;
      groupName: string;
      type: string;
      amount: number;
      currency: string;
      dueDate: string;
      description: string;
      status: string;
    }[] = [];

    for (const c of openContributions) {
      const cc = await this.prisma.contributionConfig.findUnique({
        where: { groupId: c.groupId },
      });
      const currency = cc?.currency ?? 'RWF';
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const due = new Date(c.dueDate);
      due.setHours(0, 0, 0, 0);
      const isPast = due.getTime() < now.getTime();

      let amount = dec(c.amount);
      let type = 'CONTRIBUTION';
      let status: string;
      if (c.status === ContributionStatus.LATE) {
        type = 'PENALTY';
        const rate = cc?.latePenaltyRate;
        amount = rate != null ? roundMoney(amount * (dec(rate) / 100)) : amount;
        status = 'OVERDUE';
      } else {
        status = isPast ? 'OVERDUE' : 'PENDING';
      }

      items.push({
        id: c.id,
        groupId: c.groupId,
        groupName: nameByGid.get(c.groupId) ?? 'Group',
        type: type as 'CONTRIBUTION' | 'PENALTY',
        amount,
        currency,
        dueDate: c.dueDate.toISOString(),
        description:
          c.status === ContributionStatus.LATE
            ? `Late penalty (contribution due ${c.dueDate.toISOString().slice(0, 10)})`
            : `Contribution due ${c.dueDate.toISOString().slice(0, 10)}`,
        status,
      });
    }

    if (groupIds.length > 0) {
      const manualPending = await this.prisma.depositRecord.findMany({
        where: {
          userId,
          groupId: { in: groupIds },
          status: DepositRecordStatus.PENDING_VERIFICATION,
          paymentMethod: DepositPaymentMethod.MANUAL_TRANSFER,
        },
        orderBy: { createdAt: 'desc' },
      });
      for (const d of manualPending) {
        items.push({
          id: d.id,
          groupId: d.groupId,
          groupName: nameByGid.get(d.groupId) ?? 'Group',
          type: 'DEPOSIT',
          amount: dec(d.amount),
          currency: d.currency,
          dueDate: d.createdAt.toISOString(),
          description: 'Manual bank transfer — awaiting group admin confirmation',
          status: 'PENDING_CONFIRMATION',
        });
      }
    }

    return { items };
  }

  /** Member-facing: all loan applications and disbursed member loans for the current user. */
  async getUserLoans(userId: string) {
    const [applications, memberLoans] = await Promise.all([
      this.prisma.loanApplication.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          group: { select: { id: true, name: true } },
          memberLoan: { select: { id: true } },
        },
      }),
      this.prisma.memberLoan.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: { group: { select: { id: true, name: true } } },
      }),
    ]);

    return {
      applications: applications.map((a) => {
        const gA = a.groupAdminApprovedAt != null;
        const tA = a.treasurerApprovedAt != null;
        return {
          id: a.id,
          groupId: a.groupId,
          groupName: a.group.name,
          requestedAmount: dec(a.requestedAmount),
          currency: 'RWF',
          interestRate: dec(a.interestRateSnapshot),
          repaymentPeriodDays: a.repaymentPeriodDaysSnapshot,
          status: a.status,
          createdAt: a.createdAt.toISOString(),
          groupAdminApproved: gA,
          treasurerApproved: tA,
          waitingOn:
            a.status === LoanApplicationStatus.PENDING
              ? !gA && !tA
                ? 'GROUP_ADMIN_AND_TREASURER'
                : gA && !tA
                  ? 'TREASURER'
                  : !gA && tA
                    ? 'GROUP_ADMIN'
                    : null
              : null,
          rejectionReason: a.rejectionReason,
          rejectedAt: a.rejectedAt?.toISOString() ?? null,
          disbursedLoanId: a.memberLoan?.id ?? null,
        };
      }),
      memberLoans: memberLoans.map((l) => {
        const tr = dec(l.totalRepayable);
        const rep = dec(l.amountRepaid);
        const pen = dec(l.penaltyAccrued);
        const outstanding = Math.round((tr - rep + pen) * 100) / 100;
        const now = new Date();
        const isOverdue =
          l.status === MemberLoanStatus.ACTIVE && l.dueDate < now && outstanding > 0.01;
        return {
          id: l.id,
          groupId: l.groupId,
          groupName: l.group.name,
          applicationId: l.applicationId,
          principal: dec(l.principalAmount),
          totalRepayable: tr,
          amountRepaid: rep,
          penaltyAccrued: pen,
          outstanding: Math.max(0, outstanding),
          currency: l.currency,
          interestRate: dec(l.interestRateSnapshot),
          repaymentPeriodDays: l.repaymentPeriodDaysSnapshot,
          disbursedAt: l.disbursedAt.toISOString(),
          dueDate: l.dueDate.toISOString(),
          status: l.status,
          isOverdue,
        };
      }),
    };
  }
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
