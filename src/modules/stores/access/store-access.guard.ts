import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  type StoreMemberRole,
  UserRole,
} from '../../../generated/prisma/enums.js';
import { STORE_ROLES_KEY } from './store-access.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * For routes under /business/stores/:storeId. Lets the request through only
 * if the logged-in merchant is a member of that store (and has the role the
 * route needs). Non-members get 404 so store IDs can't be probed.
 */
@Injectable()
export class StoreAccessGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;
    if (!user || user.role !== UserRole.MERCHANT) {
      throw new ForbiddenException('Only store accounts can use this');
    }

    const storeId = request.params['storeId'];
    if (typeof storeId !== 'string' || !UUID.test(storeId)) {
      throw new NotFoundException('Store not found');
    }

    const membership = await this.prisma.storeMember.findUnique({
      where: { storeId_userId: { storeId, userId: user.id } },
      include: { store: { select: { isActive: true } } },
    });
    if (!membership) throw new NotFoundException('Store not found');

    const roles = this.reflector.getAllAndOverride<
      StoreMemberRole[] | undefined
    >(STORE_ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (roles?.length && !roles.includes(membership.role)) {
      throw new ForbiddenException('Only the store owner can do this');
    }

    request.storeAccess = {
      storeId,
      userId: user.id,
      role: membership.role,
      branchId: membership.branchId,
      storeIsActive: membership.store.isActive,
    };
    return true;
  }
}
