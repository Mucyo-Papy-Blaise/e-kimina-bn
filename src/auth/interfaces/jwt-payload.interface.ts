import { RoleName } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  /** Defaults to `USER` when omitted (legacy tokens). */
  platformRole?: RoleName;
  /** Short-lived token after password-reset OTP; not valid for API auth. */
  purpose?: 'password_reset';
}
