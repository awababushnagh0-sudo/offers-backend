import type { UserRole } from '../../generated/prisma/enums.js';

/** The logged-in user, attached to the request by JwtAuthGuard. */
export interface AuthUser {
  id: string;
  role: UserRole;
  /** Still on a temporary password; most routes are blocked until it's changed. */
  mustChangePassword: boolean;
}

/** Claims inside the access token. */
export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  /** Present (true) only while the user must change their temporary password. */
  mcp?: true;
}
