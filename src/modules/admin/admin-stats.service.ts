import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import {
  ClaimStatus,
  OfferStatus,
  UserRole,
} from '../../generated/prisma/enums.js';
import type { AdminStatsDto } from './dto/admin-stats.dto.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AdminStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<AdminStatsDto> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - WEEK_MS);
    const db = this.prisma;

    const [
      storesTotal,
      storesActive,
      customers,
      merchants,
      newCustomers,
      offersTotal,
      offersLive,
      claimsTotal,
      claimsRedeemed,
      claimsExpired,
      claimsLastWeek,
    ] = await db.$transaction([
      db.store.count(),
      db.store.count({ where: { isActive: true } }),
      db.user.count({ where: { role: UserRole.CUSTOMER } }),
      db.user.count({ where: { role: UserRole.MERCHANT } }),
      db.user.count({
        where: { role: UserRole.CUSTOMER, createdAt: { gte: weekAgo } },
      }),
      db.offer.count(),
      db.offer.count({
        where: {
          status: OfferStatus.ACTIVE,
          startsAt: { lte: now },
          endsAt: { gt: now },
        },
      }),
      db.claim.count(),
      db.claim.count({ where: { status: ClaimStatus.REDEEMED } }),
      db.claim.count({ where: { status: ClaimStatus.EXPIRED } }),
      db.claim.count({ where: { createdAt: { gte: weekAgo } } }),
    ]);

    const finished = claimsRedeemed + claimsExpired;
    return {
      stores: { total: storesTotal, active: storesActive },
      users: {
        customers,
        merchants,
        newCustomersLast7Days: newCustomers,
      },
      offers: { live: offersLive, total: offersTotal },
      claims: {
        total: claimsTotal,
        redeemed: claimsRedeemed,
        expired: claimsExpired,
        last7Days: claimsLastWeek,
        redemptionRate: finished > 0 ? claimsRedeemed / finished : null,
      },
    };
  }
}
