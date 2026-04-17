import { RoleName } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  platformRole: RoleName;
}
