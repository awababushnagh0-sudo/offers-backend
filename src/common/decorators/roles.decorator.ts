import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../generated/prisma/enums.js';

export const ROLES_KEY = 'roles';

/**
 * Our team on the admin dashboard. Editors can do everything there except
 * what can't be undone (deleting a store, taking an offer down, removing
 * someone from a store) and managing the team; those routes add
 * `@Roles(UserRole.ADMIN)`.
 */
export const DASHBOARD_ROLES = [UserRole.ADMIN, UserRole.EDITOR];

/**
 * Restrict a route or controller to users with one of these roles. A route's
 * roles replace its controller's.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
