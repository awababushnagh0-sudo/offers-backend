import type { UserRole } from '../../generated/prisma/enums.js';

/** The logged-in user, attached to the request by JwtAuthGuard. */
export interface AuthUser {
  id: string;
  role: UserRole;
}

/** Claims inside the access token. */
export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}
