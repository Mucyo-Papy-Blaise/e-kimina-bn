import { SetMetadata } from '@nestjs/common';
import { RoleName } from '@prisma/client';

export const GROUP_ROLES_KEY = 'groupRoles';

export const GroupRole = (...roles: RoleName[]) =>
  SetMetadata(GROUP_ROLES_KEY, roles);
