import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { ClaimStatus, OfferStatus } from '../../generated/prisma/enums.js';
import type { PeriodStatsDto, StoreStatsDto } from './dto/store-stats.dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;
// Libya is UTC+2 all year (no daylight saving).
const LIBYA_OFFSET_MS = 2 * 60 * 60 * 1000;

@Injectable()
export class StoreStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(storeId: string): Promise<StoreStatsDto> {
    const now = new Date();
    const offerOfStore = { offer: { storeId } };

    const [liveOffers, activeReservations, today, last30Days, top] =
      await Promise.all([
        this.prisma.offer.count({
          where: {
            storeId,
            status: OfferStatus.ACTIVE,
            startsAt: { lte: now },
            endsAt: { gt: now },
          },
        }),
        this.prisma.claim.count({
          where: {
            ...offerOfStore,
            status: ClaimStatus.RESERVED,
            expiresAt: { gt: now },
          },
        }),
        this.periodStats(storeId, startOfLibyaDay(now)),
        this.periodStats(storeId, new Date(now.getTime() - 30 * DAY_MS)),
        this.prisma.claim.groupBy({
          by: ['offerId'],
          where: {
            ...offerOfStore,
            status: ClaimStatus.REDEEMED,
            createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) },
          },
          _count: { _all: true },
          orderBy: { _count: { offerId: 'desc' } },
          take: 5,
        }),
      ]);

    const offers = await this.prisma.offer.findMany({
      where: { id: { in: top.map((row) => row.offerId) } },
      select: {
        id: true,
        title: true,
        viewCount: true,
        _count: { select: { claims: true } },
      },
    });
    const byId = new Map(offers.map((offer) => [offer.id, offer]));

    return {
      liveOffers,
      activeReservations,
      today,
      last30Days,
      topOffers: top.flatMap((row) => {
        const offer = byId.get(row.offerId);
        if (!offer) return [];
        return [
          {
            offerId: offer.id,
            title: offer.title,
            views: offer.viewCount,
            claims: offer._count.claims,
            redeemed: row._count._all,
          },
        ];
      }),
    };
  }

  private async periodStats(
    storeId: string,
    since: Date,
  ): Promise<PeriodStatsDto> {
    const where = { offer: { storeId }, createdAt: { gte: since } };
    const [claims, redeemed, expired] = await Promise.all([
      this.prisma.claim.count({ where }),
      this.prisma.claim.count({
        where: { ...where, status: ClaimStatus.REDEEMED },
      }),
      this.prisma.claim.count({
        where: { ...where, status: ClaimStatus.EXPIRED },
      }),
    ]);
    const finished = redeemed + expired;
    return {
      claims,
      redeemed,
      expired,
      redemptionRate: finished > 0 ? redeemed / finished : null,
    };
  }
}

function startOfLibyaDay(now: Date): Date {
  const libyaMs = now.getTime() + LIBYA_OFFSET_MS;
  return new Date(Math.floor(libyaMs / DAY_MS) * DAY_MS - LIBYA_OFFSET_MS);
}
