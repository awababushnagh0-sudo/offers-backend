import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';
import type { StoreMemberRole } from '../../../generated/prisma/enums.js';

/** The logged-in merchant's membership in the store from the URL. */
export interface StoreAccess {
  storeId: string;
  userId: string;
  role: StoreMemberRole;
  /** Staff limited to one branch. Null means all branches. */
  branchId: string | null;
  storeIsActive: boolean;
}

export const STORE_ROLES_KEY = 'storeRoles';

/** Limit a partner route to these roles within the store (default: any member). */
export const StoreRoles = (...roles: StoreMemberRole[]) =>
  SetMetadata(STORE_ROLES_KEY, roles);

/** Injects the membership checked by StoreAccessGuard. */
export const CurrentStore = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): StoreAccess =>
    ctx.switchToHttp().getRequest<Request>().storeAccess!,
);
