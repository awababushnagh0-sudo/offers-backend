import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../../generated/prisma/enums.js';

export const ROLES_KEY = 'roles';

/** Restrict a route or controller to users with one of these roles. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
