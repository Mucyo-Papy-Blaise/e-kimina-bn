import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  GroupMembershipStatus,
  NotificationAudience,
  NotificationType,
  RoleName,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async userIdsByRoles(
    groupId: string,
    roles: RoleName[],
  ): Promise<string[]> {
    const rows = await this.prisma.userGroup.findMany({
      where: {
        groupId,
        membershipStatus: GroupMembershipStatus.ACTIVE,
        role: { name: { in: roles } },
      },
      select: { userId: true },
    });
    return [...new Set(rows.map((r) => r.userId))];
  }

  private async createMany(
    userIds: string[],
    row: {
      groupId: string | null;
      type: NotificationType;
      audience: NotificationAudience;
      title: string;
      body: string;
      metadata?: object | null;
    },
  ) {
    if (userIds.length === 0) return;
    try {
      await this.prisma.userNotification.createMany({
        data: userIds.map((userId) => ({
          userId,
          groupId: row.groupId,
          type: row.type,
          audience: row.audience,
          title: row.title,
          body: row.body,
          ...(row.metadata != null && { metadata: row.metadata }),
        })),
      });
    } catch (e) {
      this.logger.error(
        `userNotification createMany failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  private async createOne(
    userId: string,
    row: {
      groupId: string | null;
      type: NotificationType;
      audience: NotificationAudience;
      title: string;
      body: string;
      metadata?: object | null;
    },
  ) {
    await this.createMany([userId], row);
  }

  /** Manual transfer submitted — all group admins and treasurers. */
  async notifyManualDepositPending(p: {
    groupId: string;
    groupName: string;
    depositId: string;
    amount: string;
    currency: string;
    memberName: string;
    isLoanRepayment: boolean;
  }) {
    const admins = await this.userIdsByRoles(p.groupId, [RoleName.GROUP_ADMIN]);
    const treasurers = await this.userIdsByRoles(p.groupId, [
      RoleName.TREASURER,
    ]);
    const type = NotificationType.DEPOSIT_MANUAL_PENDING;
    const title = p.isLoanRepayment
      ? 'Loan repayment proof to review'
      : 'Payment proof to review';
    const body = p.isLoanRepayment
      ? `${p.memberName} submitted a loan repayment transfer (${p.amount} ${p.currency}) in ${p.groupName}.`
      : `${p.memberName} submitted a bank transfer proof (${p.amount} ${p.currency}) in ${p.groupName}.`;
    const meta = {
      groupName: p.groupName,
      depositId: p.depositId,
      amount: p.amount,
      currency: p.currency,
    };
    await this.createMany(admins, {
      groupId: p.groupId,
      type,
      audience: NotificationAudience.GROUP_ADMIN,
      title,
      body,
      metadata: meta,
    });
    await this.createMany(treasurers, {
      groupId: p.groupId,
      type,
      audience: NotificationAudience.TREASURER,
      title,
      body,
      metadata: meta,
    });
  }

  /** MoMo or instant confirmation — member receipt. */
  async notifyMemberDepositRecorded(p: {
    userId: string;
    groupId: string;
    groupName: string;
    amount: string;
    currency: string;
  }) {
    await this.createOne(p.userId, {
      groupId: p.groupId,
      type: NotificationType.DEPOSIT_RECORDED,
      audience: NotificationAudience.MEMBER,
      title: 'Payment recorded',
      body: `Your ${p.amount} ${p.currency} payment was applied in ${p.groupName}.`,
      metadata: {
        groupName: p.groupName,
        amount: p.amount,
        currency: p.currency,
      },
    });
  }

  async notifyMemberLoanRepaymentRecorded(p: {
    userId: string;
    groupId: string;
    groupName: string;
    amount: string;
    currency: string;
  }) {
    await this.createOne(p.userId, {
      groupId: p.groupId,
      type: NotificationType.LOAN_REPAYMENT_RECORDED,
      audience: NotificationAudience.MEMBER,
      title: 'Loan payment recorded',
      body: `Your ${p.amount} ${p.currency} loan payment was applied in ${p.groupName}.`,
      metadata: {
        groupName: p.groupName,
        amount: p.amount,
        currency: p.currency,
      },
    });
  }

  async notifyMemberManualDepositConfirmed(p: {
    userId: string;
    groupId: string;
    groupName: string;
    amount: string;
    currency: string;
    isLoan: boolean;
  }) {
    const type = p.isLoan
      ? NotificationType.LOAN_REPAYMENT_APPLIED
      : NotificationType.DEPOSIT_CONFIRMED;
    const title = p.isLoan ? 'Loan repayment confirmed' : 'Payment confirmed';
    const body = p.isLoan
      ? `Your loan repayment of ${p.amount} ${p.currency} was confirmed in ${p.groupName}.`
      : `Your payment of ${p.amount} ${p.currency} was confirmed in ${p.groupName}.`;
    await this.createOne(p.userId, {
      groupId: p.groupId,
      type,
      audience: NotificationAudience.MEMBER,
      title,
      body,
      metadata: {
        groupName: p.groupName,
        amount: p.amount,
        currency: p.currency,
      },
    });
  }

  async notifyMemberDepositRejected(p: {
    userId: string;
    groupId: string;
    groupName: string;
    amount: string;
    currency: string;
    reason: string | null;
  }) {
    const reason = p.reason?.trim() || 'No reason given.';
    await this.createOne(p.userId, {
      groupId: p.groupId,
      type: NotificationType.DEPOSIT_REJECTED,
      audience: NotificationAudience.MEMBER,
      title: 'Payment not accepted',
      body: `Your ${p.amount} ${p.currency} transfer in ${p.groupName} was not accepted. ${reason}`,
      metadata: { groupName: p.groupName, reason },
    });
  }

  /** Leadership audit when another admin confirms. */
  async notifyAuditManualConfirm(p: {
    groupId: string;
    groupName: string;
    amount: string;
    currency: string;
    memberName: string;
    excludeUserId: string;
  }) {
    const allAdmins = await this.userIdsByRoles(p.groupId, [
      RoleName.GROUP_ADMIN,
    ]);
    const treasurers = await this.userIdsByRoles(p.groupId, [
      RoleName.TREASURER,
    ]);
    const others = [
      ...new Set(
        [...allAdmins, ...treasurers].filter((id) => id !== p.excludeUserId),
      ),
    ];
    for (const uid of others) {
      const aud: NotificationAudience = allAdmins.includes(uid)
        ? NotificationAudience.GROUP_ADMIN
        : NotificationAudience.TREASURER;
      await this.createOne(uid, {
        groupId: p.groupId,
        type: NotificationType.MANUAL_DEPOSIT_AUDIT_CONFIRM,
        audience: aud,
        title: 'Manual payment confirmed',
        body: `A ${p.amount} ${p.currency} transfer from ${p.memberName} was confirmed in ${p.groupName}.`,
        metadata: { groupName: p.groupName },
      });
    }
  }

  async notifyAuditManualReject(p: {
    groupId: string;
    groupName: string;
    amount: string;
    currency: string;
    memberName: string;
    excludeUserId: string;
  }) {
    const allAdmins = await this.userIdsByRoles(p.groupId, [
      RoleName.GROUP_ADMIN,
    ]);
    const treasurers = await this.userIdsByRoles(p.groupId, [
      RoleName.TREASURER,
    ]);
    const others = [
      ...new Set(
        [...allAdmins, ...treasurers].filter((id) => id !== p.excludeUserId),
      ),
    ];
    for (const uid of others) {
      const aud: NotificationAudience = allAdmins.includes(uid)
        ? NotificationAudience.GROUP_ADMIN
        : NotificationAudience.TREASURER;
      await this.createOne(uid, {
        groupId: p.groupId,
        type: NotificationType.MANUAL_DEPOSIT_AUDIT_REJECT,
        audience: aud,
        title: 'Manual payment rejected',
        body: `A ${p.amount} ${p.currency} transfer from ${p.memberName} was rejected in ${p.groupName}.`,
        metadata: { groupName: p.groupName },
      });
    }
  }

  async notifyLoanApplicationSubmitted(p: {
    groupId: string;
    groupName: string;
    applicationId: string;
    applicantUserId: string;
    applicantName: string;
    amount: string;
  }) {
    await this.createOne(p.applicantUserId, {
      groupId: p.groupId,
      type: NotificationType.LOAN_APPLICATION_SUBMITTED,
      audience: NotificationAudience.MEMBER,
      title: 'Loan request received',
      body: `We received your request for ${p.amount} RWF in ${p.groupName}. A group admin and the treasurer must both approve before disbursement.`,
      metadata: {
        groupName: p.groupName,
        applicationId: p.applicationId,
        amount: p.amount,
      },
    });
    const admins = await this.userIdsByRoles(p.groupId, [RoleName.GROUP_ADMIN]);
    const treasurers = await this.userIdsByRoles(p.groupId, [
      RoleName.TREASURER,
    ]);
    await this.createMany(
      admins.filter((id) => id !== p.applicantUserId),
      {
        groupId: p.groupId,
        type: NotificationType.LOAN_APPLICATION_SUBMITTED,
        audience: NotificationAudience.GROUP_ADMIN,
        title: 'New loan application',
        body: `${p.applicantName} applied for a ${p.amount} RWF loan in ${p.groupName}. Your approval may be required.`,
        metadata: { applicationId: p.applicationId, groupName: p.groupName },
      },
    );
    await this.createMany(
      treasurers.filter((id) => id !== p.applicantUserId),
      {
        groupId: p.groupId,
        type: NotificationType.LOAN_APPLICATION_SUBMITTED,
        audience: NotificationAudience.TREASURER,
        title: 'New loan application',
        body: `${p.applicantName} applied for a ${p.amount} RWF loan in ${p.groupName}. Your approval may be required.`,
        metadata: { applicationId: p.applicationId, groupName: p.groupName },
      },
    );
  }

  /** One side approved — notify the other role. */
  async notifyLoanAwaitingOtherApprover(p: {
    groupId: string;
    groupName: string;
    applicationId: string;
    applicantName: string;
    amount: string;
    justApprovedRole: 'GROUP_ADMIN' | 'TREASURER';
  }) {
    if (p.justApprovedRole === 'GROUP_ADMIN') {
      const treasurers = await this.userIdsByRoles(p.groupId, [
        RoleName.TREASURER,
      ]);
      await this.createMany(treasurers, {
        groupId: p.groupId,
        type: NotificationType.LOAN_AWAITING_YOUR_APPROVAL,
        audience: NotificationAudience.TREASURER,
        title: 'Loan needs treasurer approval',
        body: `Group admin approved ${p.applicantName}’s ${p.amount} RWF loan in ${p.groupName}. Your approval is still required to disburse.`,
        metadata: { applicationId: p.applicationId, groupName: p.groupName },
      });
    } else {
      const admins = await this.userIdsByRoles(p.groupId, [
        RoleName.GROUP_ADMIN,
      ]);
      await this.createMany(admins, {
        groupId: p.groupId,
        type: NotificationType.LOAN_AWAITING_YOUR_APPROVAL,
        audience: NotificationAudience.GROUP_ADMIN,
        title: 'Loan needs admin approval',
        body: `Treasurer approved ${p.applicantName}’s ${p.amount} RWF loan in ${p.groupName}. A group admin must still approve to disburse.`,
        metadata: { applicationId: p.applicationId, groupName: p.groupName },
      });
    }
  }

  async notifyLoanDisbursed(p: {
    borrowerUserId: string;
    groupId: string;
    groupName: string;
    amount: string;
    memberLoanId: string;
  }) {
    await this.createOne(p.borrowerUserId, {
      groupId: p.groupId,
      type: NotificationType.LOAN_DISBURSED,
      audience: NotificationAudience.MEMBER,
      title: 'Loan disbursed',
      body: `Your ${p.amount} RWF loan in ${p.groupName} is now active. Repay on schedule to avoid penalties.`,
      metadata: { memberLoanId: p.memberLoanId, groupName: p.groupName },
    });
  }

  async notifyLoanRejected(p: {
    borrowerUserId: string;
    groupId: string;
    groupName: string;
    reason: string;
  }) {
    await this.createOne(p.borrowerUserId, {
      groupId: p.groupId,
      type: NotificationType.LOAN_REJECTED,
      audience: NotificationAudience.MEMBER,
      title: 'Loan request declined',
      body: `Your loan request in ${p.groupName} was declined. ${p.reason}`,
      metadata: { groupName: p.groupName },
    });
  }

  /** Depositor: proof received, awaiting review. */
  async notifyMemberPaymentProofSubmitted(p: {
    userId: string;
    groupId: string;
    groupName: string;
    amount: string;
    currency: string;
    isLoanRepayment: boolean;
  }) {
    await this.createOne(p.userId, {
      groupId: p.groupId,
      type: NotificationType.PAYMENT_PROOF_SUBMITTED,
      audience: NotificationAudience.MEMBER,
      title: p.isLoanRepayment
        ? 'Loan repayment received'
        : 'Payment proof received',
      body: p.isLoanRepayment
        ? `We received your ${p.amount} ${p.currency} loan repayment proof in ${p.groupName}. A group admin or treasurer will review it.`
        : `We received your ${p.amount} ${p.currency} transfer proof in ${p.groupName}. A group admin or treasurer will review it.`,
      metadata: { groupName: p.groupName },
    });
  }

  /** Member: added to a group (admin invited an existing user). */
  async notifyUserAddedToGroup(p: {
    userId: string;
    groupId: string;
    groupName: string;
    context: 'invited' | 'joined';
  }) {
    const body =
      p.context === 'joined'
        ? `You’ve joined “${p.groupName}”. You can now contribute, request loans, and use group finance features when enabled.`
        : `You were added to “${p.groupName}”. You can now participate in the group.`;
    await this.createOne(p.userId, {
      groupId: p.groupId,
      type: NotificationType.ADDED_TO_GROUP,
      audience: NotificationAudience.MEMBER,
      title:
        p.context === 'joined'
          ? 'Welcome to the group'
          : 'You were added to a group',
      body,
      metadata: { groupName: p.groupName, context: p.context },
    });
  }

  /** Pending user created for email invite; shows in-app when they complete registration. */
  async notifyPendingInvitationStored(p: {
    userId: string;
    groupId: string;
    groupName: string;
  }) {
    await this.createOne(p.userId, {
      groupId: p.groupId,
      type: NotificationType.GROUP_INVITATION_PENDING,
      audience: NotificationAudience.MEMBER,
      title: 'You’re invited to a group',
      body: `You were invited to “${p.groupName}”. Complete registration and email verification, then you’ll have access.`,
      metadata: { groupName: p.groupName },
    });
  }

  /** Admins + treasurers: someone new in the team. */
  async notifyLeadersNewMember(p: {
    groupId: string;
    groupName: string;
    memberName: string;
    memberUserId: string;
    how: 'invited' | 'joined';
  }) {
    const howText =
      p.how === 'joined'
        ? 'joined the group'
        : 'was added to the group by an admin';
    const body = `${p.memberName} ${howText} in “${p.groupName}”.`;
    const admins = await this.userIdsByRoles(p.groupId, [RoleName.GROUP_ADMIN]);
    const treasurers = await this.userIdsByRoles(p.groupId, [
      RoleName.TREASURER,
    ]);
    const title =
      p.how === 'joined' ? 'New group member' : 'New member in your group';
    const meta = {
      groupName: p.groupName,
      memberUserId: p.memberUserId,
      how: p.how,
    };
    await this.createMany(
      admins.filter((id) => id !== p.memberUserId),
      {
        groupId: p.groupId,
        type: NotificationType.NEW_GROUP_MEMBER,
        audience: NotificationAudience.GROUP_ADMIN,
        title,
        body,
        metadata: meta,
      },
    );
    await this.createMany(
      treasurers.filter((id) => id !== p.memberUserId),
      {
        groupId: p.groupId,
        type: NotificationType.NEW_GROUP_MEMBER,
        audience: NotificationAudience.TREASURER,
        title,
        body,
        metadata: meta,
      },
    );
  }

  async listForUser(
    userId: string,
    q: {
      audience?: NotificationAudience;
      groupId?: string;
      unreadOnly?: boolean;
      limit?: number;
    },
  ) {
    const limit = Math.min(q.limit ?? 50, 100);
    return this.prisma.userNotification.findMany({
      where: {
        userId,
        ...(q.audience && { audience: q.audience }),
        ...(q.groupId && { groupId: q.groupId }),
        ...(q.unreadOnly && { readAt: null }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async unreadCount(
    userId: string,
    q: { audience?: NotificationAudience; groupId?: string } = {},
  ) {
    return this.prisma.userNotification.count({
      where: {
        userId,
        readAt: null,
        ...(q.audience && { audience: q.audience }),
        ...(q.groupId && { groupId: q.groupId }),
      },
    });
  }

  async markRead(userId: string, notificationId: string) {
    const row = await this.prisma.userNotification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!row) {
      throw new NotFoundException('Notification not found.');
    }
    if (row.readAt) {
      return row;
    }
    return this.prisma.userNotification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(
    userId: string,
    q: { audience?: NotificationAudience; groupId?: string } = {},
  ) {
    return this.prisma.userNotification.updateMany({
      where: {
        userId,
        readAt: null,
        ...(q.audience && { audience: q.audience }),
        ...(q.groupId && { groupId: q.groupId }),
      },
      data: { readAt: new Date() },
    });
  }
}
