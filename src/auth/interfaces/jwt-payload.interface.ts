import { RoleName } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  /** Defaults to `USER` when omitted (legacy tokens). */
  platformRole?: RoleName;
}
