import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Env } from '../../config/env.validation.js';
import { PrismaService } from '../../database/prisma.service.js';
import {
  ClaimStatus,
  OfferStatus,
  OfferType,
} from '../../generated/prisma/enums.js';

/** Every Nth missed pickup blocks claiming for a while. */
export const NO_SHOWS_BEFORE_BAN = 3;
export const BAN_DAYS = 7;
const BATCH_SIZE = 500;

export interface ExpiryResult {
  expired: number;
  strikes: number;
  bans: number;
  endedOffers: number;
}

@Injectable()
export class ClaimsExpiryService {
  private readonly logger = new Logger(ClaimsExpiryService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'expire-claims' })
  async scheduledRun(): Promise<void> {
    // Tests call run() directly instead.
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') return;
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.run();
      if (result.expired || result.endedOffers) {
        this.logger.log(
          `Expired ${result.expired} claims (${result.strikes} strikes, ${result.bans} bans), ended ${result.endedOffers} offers`,
        );
      }
    } catch (error) {
      this.logger.error('Expiry job failed', error as Error);
    } finally {
      this.running = false;
    }
  }

  async run(now = new Date()): Promise<ExpiryResult> {
    const claims = await this.expireClaims(now);
    const endedOffers = await this.endFinishedOffers(now);
    return { ...claims, endedOffers };
  }

  private async expireClaims(now: Date) {
    const result = { expired: 0, strikes: 0, bans: 0 };
    const due = await this.prisma.claim.findMany({
      where: { status: ClaimStatus.RESERVED, expiresAt: { lte: now } },
      select: {
        id: true,
        userId: true,
        offerId: true,
        offer: { select: { type: true } },
      },
      take: BATCH_SIZE,
    });

    for (const claim of due) {
      await this.prisma.$transaction(async (tx) => {
        // Skips claims redeemed or cancelled since we looked.
        const { count } = await tx.claim.updateMany({
          where: {
            id: claim.id,
            status: ClaimStatus.RESERVED,
            expiresAt: { lte: now },
          },
          data: { status: ClaimStatus.EXPIRED },
        });
        if (count === 0) return;
        result.expired++;

        // Unlimited offers didn't hold anything back, so no strike.
        if (claim.offer.type !== OfferType.LIMITED) return;

        await tx.offer.update({
          where: { id: claim.offerId },
          data: { remainingQuantity: { increment: 1 } },
        });
        const user = await tx.user.update({
          where: { id: claim.userId },
          data: { noShowCount: { increment: 1 } },
        });
        result.strikes++;
        if (user.noShowCount % NO_SHOWS_BEFORE_BAN === 0) {
          await tx.user.update({
            where: { id: claim.userId },
            data: {
              claimBannedUntil: new Date(
                now.getTime() + BAN_DAYS * 24 * 60 * 60 * 1000,
              ),
            },
          });
          result.bans++;
        }
      });
    }
    return result;
  }

  private async endFinishedOffers(now: Date): Promise<number> {
    const { count } = await this.prisma.offer.updateMany({
      where: {
        status: { in: [OfferStatus.ACTIVE, OfferStatus.PAUSED] },
        endsAt: { lte: now },
      },
      data: { status: OfferStatus.ENDED },
    });
    return count;
  }
}
