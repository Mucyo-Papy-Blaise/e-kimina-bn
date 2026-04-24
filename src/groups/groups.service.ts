import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GroupMembershipStatus,
  GroupRemovalKind,
  Prisma,
  RoleName,
} from '@prisma/client';
import { hash } from 'bcryptjs';
import { EmailService } from '../email/email.service.js';
import { appConfig } from '../config/app.config';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { CreateGroupDto } from './dto/create-group.dto';

type AppConfig = ReturnType<typeof appConfig>;

const groupSelect = {
  id: true,
  name: true,
  description: true,
  isPublic: true,
  createdById: true,
  isVerified: true,
  minMembers: true,
  createdAt: true,
} satisfies Prisma.GroupSelect;

export type GroupSummary = Prisma.GroupGetPayload<{
  select: typeof groupSelect;
}>;

/** API shape: `minMembers` in DB is exposed as `maxMembers` to clients. */
export type GroupApiRow = Omit<GroupSummary, 'minMembers'> & {
  maxMembers: number;
};

export type GroupListFilter = {
  view?: 'mine' | 'discover';
  legacyPublicOnly?: boolean;
};

@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rolesService: RolesService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  private groupWithMemberCount(
    group: GroupSummary,
    memberCount: number,
  ): GroupApiRow & { memberCount: number } {
    const { minMembers, ...rest } = group;
    return { ...rest, maxMembers: minMembers, memberCount };
  }

  private toGroupApiRow(group: GroupSummary): GroupApiRow {
    const { minMembers, ...rest } = group;
    return { ...rest, maxMembers: minMembers };
  }

  private async compensateTreasurerInviteFailure(
    groupId: string,
  ): Promise<void> {
    const inv = await this.prisma.treasurerInvitation.findFirst({
      where: { groupId },
      select: { userId: true },
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.group.delete({ where: { id: groupId } });
      if (inv?.userId) {
        await tx.user.delete({ where: { id: inv.userId } });
      }
    });
  }

  /** Removes pending user created for a failed member invite email (cascades memberships + invitation). */
  private async rollbackPendingMemberInvite(pendingUserId: string): Promise<void> {
    await this.prisma.user.delete({ where: { id: pendingUserId } });
  }

  private async assertGroupAdmin(
    userId: string,
    groupId: string,
  ): Promise<void> {
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
        'Only the group admin can perform this action.',
      );
    }
  }

  private async isPlatformSuperAdmin(userId: string): Promise<boolean> {
    const pr = await this.prisma.userPlatformRole.findFirst({
      where: { userId },
      include: { role: true },
    });
    return pr?.role.name === RoleName.SUPER_ADMIN;
  }

  /** Used by group-scoped GET handlers (e.g. contribution config) for oversight without membership. */
  async isPlatformSuperAdminUser(userId: string): Promise<boolean> {
    return this.isPlatformSuperAdmin(userId);
  }

  private activeMemberFilter() {
    return { membershipStatus: GroupMembershipStatus.ACTIVE };
  }

  private async countActiveMembers(groupId: string): Promise<number> {
    return this.prisma.userGroup.count({
      where: {
        groupId,
        membershipStatus: GroupMembershipStatus.ACTIVE,
      },
    });
  }

  async create(
    userId: string,
    dto: CreateGroupDto,
  ): Promise<GroupApiRow & { memberCount: number }> {
    const groupAdminRoleId = await this.rolesService.getRoleId(
      RoleName.GROUP_ADMIN,
    );
    const treasurerRoleId = await this.rolesService.getRoleId(
      RoleName.TREASURER,
    );
    const bcryptRounds = this.configService.get('auth.bcryptSaltRounds', {
      infer: true,
    });

    const rawTreasurer = dto.treasurerEmail?.trim();
    const normalizedTreasurerEmail = rawTreasurer?.toLowerCase();
    let existingTreasurerUserId: string | undefined;

    if (normalizedTreasurerEmail) {
      const treasurer = await this.prisma.user.findUnique({
        where: { email: normalizedTreasurerEmail },
      });

      if (treasurer) {
        if (!treasurer.isActive) {
          throw new ConflictException(
            'This email already has a pending treasurer invitation. Ask them to finish registration first.',
          );
        }
        if (treasurer.id === userId) {
          throw new BadRequestException(
            'Pick someone else as treasurer — you are already the group admin.',
          );
        }
        existingTreasurerUserId = treasurer.id;
      }
    }

    /** New treasurer = invitation email; need outbound SMTP before we touch the DB. */
    if (
      normalizedTreasurerEmail &&
      !existingTreasurerUserId &&
      !process.env.SMTP_HOST?.trim()
    ) {
      throw new BadRequestException(
        'To invite a treasurer who does not have an account yet, configure SMTP in .env (SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM_EMAIL, SMTP_FROM_NAME).',
      );
    }

    const seatsNeeded = 1 + (normalizedTreasurerEmail ? 1 : 0);
    if (dto.minMembers < seatsNeeded) {
      throw new BadRequestException(
        `Minimum members must be at least ${seatsNeeded} (admin${normalizedTreasurerEmail ? ' + treasurer' : ''}).`,
      );
    }

    let txResult: {
      group: GroupSummary;
      invitation: {
        token: string;
        email: string;
        groupName: string;
      } | null;
    };

    try {
      txResult = await this.prisma.$transaction(async (tx) => {
        const created = await tx.group.create({
          data: {
            name: dto.name,
            description: dto.description,
            createdById: userId,
            minMembers: dto.minMembers,
            isPublic: dto.isPublic ?? false,
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

        let invitation: {
          token: string;
          email: string;
          groupName: string;
        } | null = null;

        if (normalizedTreasurerEmail) {
          if (existingTreasurerUserId) {
            await tx.userGroup.create({
              data: {
                userId: existingTreasurerUserId,
                groupId: created.id,
                roleId: treasurerRoleId,
              },
            });
          } else {
            const passwordHash = await hash(
              randomBytes(64).toString('hex'),
              bcryptRounds,
            );
            const pendingUser = await tx.user.create({
              data: {
                email: normalizedTreasurerEmail,
                fullName: 'Pending treasurer invitation',
                passwordHash,
                isActive: false,
                platformRoles: {
                  create: {
                    role: { connect: { name: RoleName.USER } },
                  },
                },
              },
            });

            await tx.userGroup.create({
              data: {
                userId: pendingUser.id,
                groupId: created.id,
                roleId: treasurerRoleId,
              },
            });

            const token = randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

            await tx.treasurerInvitation.create({
              data: {
                token,
                groupId: created.id,
                userId: pendingUser.id,
                expiresAt,
              },
            });

            invitation = {
              token,
              email: normalizedTreasurerEmail,
              groupName: created.name,
            };
          }
        }

        return { group: created, invitation };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Could not create the group. Check the treasurer email or try again.',
        );
      }
      throw error;
    }

    if (txResult.invitation) {
      try {
        await this.emailService.sendTreasurerInvitationEmail(
          txResult.invitation.email,
          txResult.invitation.token,
          txResult.invitation.groupName,
        );
      } catch (e) {
        await this.compensateTreasurerInviteFailure(txResult.group.id);
        const reason = e instanceof Error ? e.message : String(e);
        this.logger.error(
          `Treasurer invitation email failed; rolled back group ${txResult.group.id}: ${reason}`,
          e instanceof Error ? e.stack : undefined,
        );
        const isProd = process.env.NODE_ENV === 'production';
        throw new BadRequestException(
          isProd
            ? 'Could not send the treasurer invitation email. Check SMTP settings and try again.'
            : `Could not send the treasurer invitation email: ${reason}`,
        );
      }
    }

    const memberCount = await this.countActiveMembers(txResult.group.id);

    return this.groupWithMemberCount(txResult.group, memberCount);
  }

  async findAll(
    userId: string,
    filter: GroupListFilter = {},
  ): Promise<(GroupApiRow & { memberCount: number })[]> {
    let where: Prisma.GroupWhereInput | undefined;

    if (filter.view === 'mine') {
      where = {
        userGroups: {
          some: {
            userId,
            membershipStatus: GroupMembershipStatus.ACTIVE,
          },
        },
      };
    } else if (filter.view === 'discover') {
      where = {
        isPublic: true,
        createdById: { not: userId },
      };
    } else if (filter.legacyPublicOnly) {
      where = { isPublic: true };
    }

    const groups = await this.prisma.group.findMany({
      where,
      select: groupSelect,
      orderBy: { createdAt: 'desc' },
    });

    const counts = await this.prisma.userGroup.groupBy({
      by: ['groupId'],
      where: { membershipStatus: GroupMembershipStatus.ACTIVE },
      _count: { _all: true },
    });

    const countByGroupId = new Map(
      counts.map((row) => [row.groupId, row._count._all]),
    );

    return groups.map((group) =>
      this.groupWithMemberCount(group, countByGroupId.get(group.id) ?? 0),
    );
  }

  async findOneForUser(
    groupId: string,
    userId: string,
  ): Promise<
    GroupApiRow & {
      memberCount: number;
      myRole: RoleName;
      isGroupAdmin: boolean;
    }
  > {
    const membership = await this.prisma.userGroup.findFirst({
      where: {
        userId,
        groupId,
        membershipStatus: GroupMembershipStatus.ACTIVE,
      },
      include: { role: true },
    });

    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: groupSelect,
    });

    if (!group) {
      throw new NotFoundException(`Group ${groupId} was not found.`);
    }

    const memberCount = await this.countActiveMembers(groupId);
    const row = this.groupWithMemberCount(group, memberCount);

    if (membership) {
      return {
        ...row,
        myRole: membership.role.name,
        isGroupAdmin: membership.role.name === RoleName.GROUP_ADMIN,
      };
    }

    if (await this.isPlatformSuperAdmin(userId)) {
      return {
        ...row,
        myRole: RoleName.MEMBER,
        isGroupAdmin: false,
      };
    }

    throw new ForbiddenException('You do not have access to this group.');
  }

  async join(userId: string, groupId: string): Promise<void> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException(`Group ${groupId} was not found.`);
    }

    if (!group.isPublic) {
      throw new ForbiddenException(
        'This group is private. You cannot join without an invitation.',
      );
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
      if (existing.membershipStatus === GroupMembershipStatus.SUSPENDED) {
        throw new ForbiddenException(
          'Your membership in this group is suspended. Contact the group admin.',
        );
      }
      throw new ConflictException('You are already a member of this group.');
    }

    const memberCount = await this.countActiveMembers(groupId);

    if (memberCount >= group.minMembers) {
      throw new BadRequestException('This group has reached its member limit.');
    }

    const memberRoleId = await this.rolesService.getRoleId(RoleName.MEMBER);

    await this.prisma.userGroup.create({
      data: {
        userId,
        groupId,
        roleId: memberRoleId,
        membershipStatus: GroupMembershipStatus.ACTIVE,
      },
    });
  }

  /**
   * Group admin invites a member by email. Existing active users are added immediately;
   * new emails get a pending account + invitation link (same pattern as treasurer invite).
   */
  async inviteMember(
    inviterUserId: string,
    groupId: string,
    email: string,
  ): Promise<{ message: string }> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, name: true, minMembers: true },
    });
    if (!group) {
      throw new NotFoundException(`Group ${groupId} was not found.`);
    }

    await this.assertGroupAdmin(inviterUserId, groupId);

    const memberCount = await this.countActiveMembers(groupId);
    if (memberCount >= group.minMembers) {
      throw new BadRequestException(
        'This group has reached its member limit.',
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const inviter = await this.prisma.user.findUnique({
      where: { id: inviterUserId },
      select: { email: true },
    });
    if (inviter?.email.toLowerCase() === normalizedEmail) {
      throw new BadRequestException('You cannot invite yourself as a member.');
    }

    const memberRoleId = await this.rolesService.getRoleId(RoleName.MEMBER);

    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      if (!existing.isActive) {
        const memberInv = await this.prisma.memberInvitation.findUnique({
          where: { userId: existing.id },
        });
        if (memberInv?.groupId === groupId) {
          const token = randomBytes(32).toString('hex');
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          await this.prisma.memberInvitation.update({
            where: { id: memberInv.id },
            data: { token, expiresAt },
          });
          try {
            await this.emailService.sendMemberInvitationEmail(
              normalizedEmail,
              token,
              group.name,
            );
          } catch (e) {
            const reason = e instanceof Error ? e.message : String(e);
            this.logger.error(
              `Member invitation resend failed: ${reason}`,
              e instanceof Error ? e.stack : undefined,
            );
            const isProd = process.env.NODE_ENV === 'production';
            throw new BadRequestException(
              isProd
                ? 'Could not resend the invitation email. Check SMTP settings and try again.'
                : `Could not resend the invitation email: ${reason}`,
            );
          }
          return { message: 'Invitation email resent.' };
        }
        if (memberInv && memberInv.groupId !== groupId) {
          throw new ConflictException(
            'This email already has a pending invitation to another group.',
          );
        }
        const treasInv = await this.prisma.treasurerInvitation.findUnique({
          where: { userId: existing.id },
        });
        if (treasInv) {
          throw new ConflictException(
            'This email has a pending treasurer invitation. They must complete registration first.',
          );
        }
        throw new ConflictException(
          'This email has a pending account. Ask them to complete registration first.',
        );
      }

      const ug = await this.prisma.userGroup.findUnique({
        where: { userId_groupId: { userId: existing.id, groupId } },
      });
      if (ug) {
        if (ug.membershipStatus === GroupMembershipStatus.SUSPENDED) {
          throw new ForbiddenException(
            'This user is suspended in this group. Reactivate them from the group page.',
          );
        }
        throw new ConflictException(
          'This user is already a member of this group.',
        );
      }
      await this.prisma.userGroup.create({
        data: {
          userId: existing.id,
          groupId,
          roleId: memberRoleId,
          membershipStatus: GroupMembershipStatus.ACTIVE,
        },
      });
      return { message: 'Member added to the group.' };
    }

    if (!process.env.SMTP_HOST?.trim()) {
      throw new BadRequestException(
        'To invite someone new, configure SMTP in .env (SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM_EMAIL, SMTP_FROM_NAME).',
      );
    }

    const bcryptRounds = this.configService.get('auth.bcryptSaltRounds', {
      infer: true,
    });

    let pendingUserId: string;
    let token: string;
    try {
      const txResult = await this.prisma.$transaction(async (tx) => {
        const passwordHash = await hash(
          randomBytes(64).toString('hex'),
          bcryptRounds,
        );
        const pendingUser = await tx.user.create({
          data: {
            email: normalizedEmail,
            fullName: 'Pending team invitation',
            passwordHash,
            isActive: false,
            platformRoles: {
              create: {
                role: { connect: { name: RoleName.USER } },
              },
            },
          },
        });

        await tx.userGroup.create({
          data: {
            userId: pendingUser.id,
            groupId,
            roleId: memberRoleId,
            membershipStatus: GroupMembershipStatus.ACTIVE,
          },
        });

        const inviteToken = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await tx.memberInvitation.create({
          data: {
            token: inviteToken,
            groupId,
            userId: pendingUser.id,
            expiresAt,
          },
        });

        return { pendingUserId: pendingUser.id, token: inviteToken };
      });
      pendingUserId = txResult.pendingUserId;
      token = txResult.token;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Could not create the invitation. Please try again.',
        );
      }
      throw error;
    }

    try {
      await this.emailService.sendMemberInvitationEmail(
        normalizedEmail,
        token,
        group.name,
      );
    } catch (e) {
      await this.rollbackPendingMemberInvite(pendingUserId);
      const reason = e instanceof Error ? e.message : String(e);
      this.logger.error(
        `Member invitation email failed; rolled back pending user ${pendingUserId}: ${reason}`,
        e instanceof Error ? e.stack : undefined,
      );
      const isProd = process.env.NODE_ENV === 'production';
      throw new BadRequestException(
        isProd
          ? 'Could not send the invitation email. Check SMTP settings and try again.'
          : `Could not send the invitation email: ${reason}`,
      );
    }

    return {
      message:
        'Invitation sent. They can register and join the group from the email link.',
    };
  }

  async listRemovalNotifications(userId: string) {
    return this.prisma.groupRemovalNotification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        groupId: true,
        groupName: true,
        kind: true,
        reason: true,
        readAt: true,
        createdAt: true,
      },
    });
  }

  async markRemovalNotificationRead(userId: string, notificationId: string) {
    const row = await this.prisma.groupRemovalNotification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!row) {
      throw new NotFoundException('Notification not found.');
    }
    await this.prisma.groupRemovalNotification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  async updateGroup(
    actorUserId: string,
    groupId: string,
    data: { name?: string; description?: string | null },
  ): Promise<GroupApiRow & { memberCount: number }> {
    if (data.name === undefined && data.description === undefined) {
      throw new BadRequestException('Provide at least name or description to update.');
    }
    await this.assertGroupAdmin(actorUserId, groupId);
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: groupSelect,
    });
    if (!group) {
      throw new NotFoundException(`Group ${groupId} was not found.`);
    }
    const updated = await this.prisma.group.update({
      where: { id: groupId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      },
      select: groupSelect,
    });
    const memberCount = await this.countActiveMembers(groupId);
    return this.groupWithMemberCount(updated, memberCount);
  }

  async deleteGroup(actorUserId: string, groupId: string): Promise<void> {
    await this.assertGroupAdmin(actorUserId, groupId);
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException(`Group ${groupId} was not found.`);
    }
    await this.prisma.group.delete({ where: { id: groupId } });
  }

  async listMembers(groupId: string, userId: string) {
    const membership = await this.prisma.userGroup.findFirst({
      where: {
        userId,
        groupId,
        membershipStatus: GroupMembershipStatus.ACTIVE,
      },
      include: { role: true },
    });
    const superAdmin =
      !membership && (await this.isPlatformSuperAdmin(userId));

    if (!membership && !superAdmin) {
      throw new ForbiddenException('You do not have access to this group.');
    }

    const isAdmin =
      membership?.role.name === RoleName.GROUP_ADMIN || superAdmin;

    const rows = await this.prisma.userGroup.findMany({
      where: {
        groupId,
        ...(isAdmin ? {} : { membershipStatus: GroupMembershipStatus.ACTIVE }),
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        role: { select: { name: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return rows.map((r) => ({
      userId: r.userId,
      fullName: r.user.fullName,
      email: r.user.email,
      role: r.role.name,
      membershipStatus: r.membershipStatus,
      joinedAt: r.joinedAt.toISOString(),
    }));
  }

  async removeMember(
    actorUserId: string,
    groupId: string,
    memberUserId: string,
    reason: string,
  ): Promise<void> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, name: true, createdById: true },
    });
    if (!group) {
      throw new NotFoundException(`Group ${groupId} was not found.`);
    }
    await this.assertGroupAdmin(actorUserId, groupId);

    if (memberUserId === group.createdById) {
      throw new BadRequestException(
        'Cannot remove the group creator from the group.',
      );
    }
    if (memberUserId === actorUserId) {
      throw new BadRequestException(
        'You cannot remove yourself from the group.',
      );
    }

    const ug = await this.prisma.userGroup.findUnique({
      where: {
        userId_groupId: { userId: memberUserId, groupId },
      },
    });
    if (!ug) {
      throw new NotFoundException('This user is not in the group.');
    }

    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      throw new BadRequestException(
        'Please provide a reason (at least 3 characters).',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.groupRemovalNotification.create({
        data: {
          userId: memberUserId,
          groupId,
          groupName: group.name,
          kind: GroupRemovalKind.REMOVED,
          reason: trimmed,
        },
      });
      await tx.userGroup.delete({ where: { id: ug.id } });
    });
  }

  async suspendMember(
    actorUserId: string,
    groupId: string,
    memberUserId: string,
    reason: string,
  ): Promise<void> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, name: true, createdById: true },
    });
    if (!group) {
      throw new NotFoundException(`Group ${groupId} was not found.`);
    }
    await this.assertGroupAdmin(actorUserId, groupId);

    if (memberUserId === group.createdById) {
      throw new BadRequestException(
        'Cannot suspend the group creator in the group.',
      );
    }
    if (memberUserId === actorUserId) {
      throw new BadRequestException('You cannot suspend yourself.');
    }

    const ug = await this.prisma.userGroup.findUnique({
      where: {
        userId_groupId: { userId: memberUserId, groupId },
      },
    });
    if (!ug) {
      throw new NotFoundException('This user is not in the group.');
    }
    if (ug.membershipStatus === GroupMembershipStatus.SUSPENDED) {
      throw new BadRequestException('This member is already suspended.');
    }

    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      throw new BadRequestException(
        'Please provide a reason (at least 3 characters).',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.groupRemovalNotification.create({
        data: {
          userId: memberUserId,
          groupId,
          groupName: group.name,
          kind: GroupRemovalKind.SUSPENDED,
          reason: trimmed,
        },
      });
      await tx.userGroup.update({
        where: { id: ug.id },
        data: { membershipStatus: GroupMembershipStatus.SUSPENDED },
      });
    });
  }

  async reactivateMember(
    actorUserId: string,
    groupId: string,
    memberUserId: string,
  ): Promise<void> {
    await this.assertGroupAdmin(actorUserId, groupId);

    const ug = await this.prisma.userGroup.findUnique({
      where: {
        userId_groupId: { userId: memberUserId, groupId },
      },
    });
    if (!ug) {
      throw new NotFoundException('This user is not in the group.');
    }
    if (ug.membershipStatus !== GroupMembershipStatus.SUSPENDED) {
      throw new BadRequestException('This member is not suspended.');
    }

    await this.prisma.userGroup.update({
      where: { id: ug.id },
      data: { membershipStatus: GroupMembershipStatus.ACTIVE },
    });
  }

  async togglePublic(
    actorUserId: string,
    groupId: string,
    isPublic: boolean,
  ): Promise<GroupApiRow> {
    await this.assertGroupAdmin(actorUserId, groupId);
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: groupSelect,
    });

    if (!group) {
      throw new NotFoundException(`Group ${groupId} was not found.`);
    }

    const updated = await this.prisma.group.update({
      where: { id: groupId },
      data: { isPublic: isPublic },
      select: groupSelect,
    });
    return this.toGroupApiRow(updated);
  }

  async verifyGroup(groupId: string): Promise<GroupApiRow> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: groupSelect,
    });

    if (!group) {
      throw new NotFoundException(`Group ${groupId} was not found.`);
    }

    const updated = await this.prisma.group.update({
      where: { id: groupId },
      data: { isVerified: true },
      select: groupSelect,
    });
    return this.toGroupApiRow(updated);
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

  /** Same rules as loan config: verified group, active membership, `GROUP_ADMIN` or `TREASURER`. */
  async assertUserCanAccessContributionConfig(userId: string, groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException(`Group ${groupId} was not found.`);
    }

    if (!group.isVerified) {
      throw new ForbiddenException(
        'Contribution settings are only available after the group is verified by a super admin.',
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

    const allowed = new Set<RoleName>([
      RoleName.GROUP_ADMIN,
      RoleName.TREASURER,
    ]);

    if (!allowed.has(membership.role.name)) {
      throw new ForbiddenException(
        'Only group admins and treasurers can manage contribution settings for this group.',
      );
    }
  }
}
