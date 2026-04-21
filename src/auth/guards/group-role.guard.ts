import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GroupMembershipStatus, RoleName } from '@prisma/client';
import { GROUP_ROLES_KEY } from '../../decorators/group-role.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

@Injectable()
export class GroupRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<RoleName[]>(
      GROUP_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser; params?: { groupId?: string } }>();

    const user = request.user;

    if (!user) {
      return false;
    }

    const groupId = request.params?.groupId;

    if (!groupId) {
      throw new ForbiddenException(
        'This route requires a :groupId route parameter.',
      );
    }

    const membership = await this.prisma.userGroup.findFirst({
      where: {
        userId: user.id,
        groupId,
        membershipStatus: GroupMembershipStatus.ACTIVE,
      },
      include: {
        role: true,
      },
    });

    if (!membership) {
      return false;
    }

    return requiredRoles.includes(membership.role.name);
  }
}
