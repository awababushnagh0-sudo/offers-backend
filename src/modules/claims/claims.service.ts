import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { pageArgs, pageMeta } from '../../common/dto/pagination.dto.js';
import { generateClaimCode } from '../../common/utils/claim-code.js';
import { formatPrice } from '../../common/utils/money.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { ClaimStatus, OfferType } from '../../generated/prisma/enums.js';
import { StorageService } from '../../storage/storage.service.js';
import { OfferState, offerState } from '../offers/offer-state.js';
import {
  liveOfferWhere,
  toBranchDto,
} from '../offers/public-offers.service.js';
import type {
  CustomerClaimDto,
  CustomerClaimListDto,
  ListMyClaimsQueryDto,
} from './dto/customer-claims.dto.js';

/** Reservations (LIMITED offers) a customer can hold at the same time. */
export const MAX_ACTIVE_RESERVATIONS = 3;

const customerClaimInclude = {
  offer: {
    include: {
      store: { select: { id: true, name: true, logoUrl: true } },
      product: { select: { thumbPath: true } },
      branches: { include: { branch: true } },
    },
  },
} satisfies Prisma.ClaimInclude;

type CustomerClaim = Prisma.ClaimGetPayload<{
  include: typeof customerClaimInclude;
}>;

/** The customer side of claims: claiming, my claims, cancelling. */
@Injectable()
export class ClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async claim(userId: string, offerId: string): Promise<CustomerClaimDto> {
    const claimId = await this.prisma.$transaction(async (tx) => {
      // One claim at a time per customer, so double taps can't get around
      // the limits below. Other customers aren't blocked.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      const now = new Date();

      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (!user.isActive) throw new ForbiddenException('Account is disabled');
      if (user.claimBannedUntil && user.claimBannedUntil > now) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'ClaimBanned',
          message: `Too many missed pickups. You can claim again after ${user.claimBannedUntil.toISOString()}`,
        });
      }

      const offer = await tx.offer.findFirst({
        where: { AND: [{ id: offerId }, liveOfferWhere(now)] },
      });
      if (!offer) throw await this.unavailableError(tx, offerId);

      const active = await tx.claim.findFirst({
        where: {
          offerId,
          userId,
          status: ClaimStatus.RESERVED,
          expiresAt: { gt: now },
        },
      });
      if (active) {
        throw new ConflictException(
          'You already have an active reservation for this offer',
        );
      }

      const used = await tx.claim.count({
        where: {
          offerId,
          userId,
          status: { in: [ClaimStatus.RESERVED, ClaimStatus.REDEEMED] },
        },
      });
      if (used >= offer.maxPerUser) {
        throw new ConflictException(
          "You've already claimed this offer the maximum number of times",
        );
      }

      let expiresAt = offer.endsAt;
      if (offer.type === OfferType.LIMITED) {
        const reservations = await tx.claim.count({
          where: {
            userId,
            status: ClaimStatus.RESERVED,
            expiresAt: { gt: now },
            offer: { type: OfferType.LIMITED },
          },
        });
        if (reservations >= MAX_ACTIVE_RESERVATIONS) {
          throw new ConflictException(
            `You can hold at most ${MAX_ACTIVE_RESERVATIONS} reservations at a time. Pick one up or cancel one first.`,
          );
        }

        // Atomic: only succeeds while there's at least one piece left.
        const { count } = await tx.offer.updateMany({
          where: { id: offerId, remainingQuantity: { gt: 0 } },
          data: { remainingQuantity: { decrement: 1 } },
        });
        if (count === 0) throw new ConflictException('Sold out');

        const windowEnd = new Date(
          now.getTime() + offer.claimWindowMinutes * 60_000,
        );
        expiresAt = windowEnd < offer.endsAt ? windowEnd : offer.endsAt;
      }

      const claim = await tx.claim.create({
        data: {
          offerId,
          userId,
          code: await uniqueCode(tx),
          expiresAt,
        },
      });
      return claim.id;
    });

    return this.get(userId, claimId);
  }

  async list(
    userId: string,
    query: ListMyClaimsQueryDto,
  ): Promise<CustomerClaimListDto> {
    const where: Prisma.ClaimWhereInput = query.active
      ? {
          userId,
          status: ClaimStatus.RESERVED,
          expiresAt: { gt: new Date() },
        }
      : { userId };
    const [claims, total] = await this.prisma.$transaction([
      this.prisma.claim.findMany({
        where,
        include: customerClaimInclude,
        orderBy: query.active ? { expiresAt: 'asc' } : { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.claim.count({ where }),
    ]);
    return {
      items: claims.map((claim) => this.toDto(claim)),
      meta: pageMeta(query, total),
    };
  }

  async get(userId: string, claimId: string): Promise<CustomerClaimDto> {
    const claim = await this.prisma.claim.findFirst({
      where: { id: claimId, userId },
      include: customerClaimInclude,
    });
    if (!claim) throw new NotFoundException('Claim not found');
    return this.toDto(claim);
  }

  /** Gives the piece back. No strike, since the store is told in time. */
  async cancel(userId: string, claimId: string): Promise<CustomerClaimDto> {
    const claim = await this.prisma.claim.findFirst({
      where: { id: claimId, userId },
      include: { offer: { select: { type: true } } },
    });
    if (!claim) throw new NotFoundException('Claim not found');

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const { count } = await tx.claim.updateMany({
        where: {
          id: claimId,
          status: ClaimStatus.RESERVED,
          expiresAt: { gt: now },
        },
        data: { status: ClaimStatus.CANCELLED, cancelledAt: now },
      });
      if (count === 0) {
        throw new ConflictException(
          'Only active reservations can be cancelled',
        );
      }
      if (claim.offer.type === OfferType.LIMITED) {
        await tx.offer.update({
          where: { id: claim.offerId },
          data: { remainingQuantity: { increment: 1 } },
        });
      }
    });
    return this.get(userId, claimId);
  }

  /** Explains why an offer can't be claimed. */
  private async unavailableError(
    tx: Prisma.TransactionClient,
    offerId: string,
  ) {
    const offer = await tx.offer.findUnique({
      where: { id: offerId },
      include: { store: { select: { isActive: true } } },
    });
    if (!offer || !offer.store.isActive) {
      return new NotFoundException('Offer not found');
    }
    switch (offerState(offer)) {
      case OfferState.SOLD_OUT:
        return new ConflictException('Sold out');
      case OfferState.SCHEDULED:
        return new ConflictException("This offer hasn't started yet");
      case OfferState.REMOVED:
        return new NotFoundException('Offer not found');
      default:
        return new ConflictException('This offer is no longer available');
    }
  }

  private toDto(claim: CustomerClaim): CustomerClaimDto {
    const now = new Date();
    const isActive =
      claim.status === ClaimStatus.RESERVED && claim.expiresAt > now;
    return {
      id: claim.id,
      code: claim.code,
      status:
        claim.status === ClaimStatus.RESERVED && !isActive
          ? ClaimStatus.EXPIRED
          : claim.status,
      expiresAt: claim.expiresAt,
      redeemedAt: claim.redeemedAt,
      cancelledAt: claim.cancelledAt,
      createdAt: claim.createdAt,
      offer: {
        id: claim.offer.id,
        title: claim.offer.title,
        offerPrice: formatPrice(claim.offer.offerPrice),
        originalPrice: formatPrice(claim.offer.originalPrice),
        thumbUrl: this.storage.url(claim.offer.product.thumbPath),
        type: claim.offer.type,
      },
      store: {
        id: claim.offer.store.id,
        name: claim.offer.store.name,
        logoUrl: this.storage.url(claim.offer.store.logoUrl),
      },
      branches: claim.offer.branches
        .map(({ branch }) => branch)
        .filter((branch) => branch.isActive)
        .map((branch) => toBranchDto(branch, undefined)),
      canCancel: isActive,
    };
  }
}

async function uniqueCode(tx: Prisma.TransactionClient): Promise<string> {
  // Collisions are astronomically unlikely, but cheap to rule out.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateClaimCode();
    const taken = await tx.claim.count({ where: { code } });
    if (taken === 0) return code;
  }
  throw new Error('Could not generate a unique claim code');
}
