import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { pageArgs, pageMeta } from '../../common/dto/pagination.dto.js';
import { formatPrice } from '../../common/utils/money.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  ClaimStatus,
  OfferStatus,
  OfferType,
} from '../../generated/prisma/enums.js';
import { StorageService } from '../../storage/storage.service.js';
import type { StoreAccess } from '../stores/access/store-access.js';
import type {
  BusinessOfferDto,
  BusinessOfferListDto,
  ClaimCountsDto,
  CreateOfferDto,
  ListBusinessOffersQueryDto,
  UpdateOfferDto,
} from './dto/business-offers.dto.js';
import { discountPercent, offerState } from './offer-state.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DURATION_MS = 30 * DAY_MS;
// Allow a start time slightly in the past (phone clocks drift).
const START_TOLERANCE_MS = 5 * 60 * 1000;

const offerInclude = {
  product: { select: { imagePath: true, thumbPath: true } },
  branches: { select: { branchId: true } },
} satisfies Prisma.OfferInclude;

type OfferWithRelations = Prisma.OfferGetPayload<{
  include: typeof offerInclude;
}>;

@Injectable()
export class BusinessOffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async list(
    storeId: string,
    query: ListBusinessOffersQueryDto,
  ): Promise<BusinessOfferListDto> {
    const where: Prisma.OfferWhereInput = { storeId, status: query.status };
    const [offers, total] = await this.prisma.$transaction([
      this.prisma.offer.findMany({
        where,
        include: offerInclude,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.offer.count({ where }),
    ]);
    const counts = await this.claimCounts(offers.map((offer) => offer.id));
    return {
      items: offers.map((offer) => this.toDto(offer, counts.get(offer.id))),
      meta: pageMeta(query, total),
    };
  }

  async get(storeId: string, offerId: string): Promise<BusinessOfferDto> {
    const offer = await this.findInStore(storeId, offerId);
    const counts = await this.claimCounts([offer.id]);
    return this.toDto(offer, counts.get(offer.id));
  }

  async create(
    store: StoreAccess,
    dto: CreateOfferDto,
  ): Promise<BusinessOfferDto> {
    assertStoreActive(store);

    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, storeId: store.storeId, isArchived: false },
    });
    if (!product) throw new BadRequestException('Product not found');
    if (product.regularPrice.lte(dto.offerPrice)) {
      throw new BadRequestException(
        `Offer price must be lower than the regular price (${formatPrice(product.regularPrice)} LD)`,
      );
    }

    if (dto.type === OfferType.LIMITED && !dto.totalQuantity) {
      throw new BadRequestException('Limited offers need a totalQuantity');
    }
    if (dto.type === OfferType.UNLIMITED && dto.totalQuantity) {
      throw new BadRequestException(
        'Unlimited offers cannot have a totalQuantity',
      );
    }

    const now = Date.now();
    const startsAt = dto.startsAt ?? new Date(now);
    if (startsAt.getTime() < now - START_TOLERANCE_MS) {
      throw new BadRequestException('Start time cannot be in the past');
    }
    if (startsAt.getTime() > now + MAX_DURATION_MS) {
      throw new BadRequestException('Start time must be within 30 days');
    }
    assertValidEnd(startsAt, dto.endsAt);

    const branchIds = await this.resolveBranches(store.storeId, dto.branchIds);

    const offer = await this.prisma.offer.create({
      data: {
        storeId: store.storeId,
        productId: product.id,
        title: dto.title ?? product.title,
        description: dto.description ?? product.description,
        originalPrice: product.regularPrice,
        offerPrice: dto.offerPrice,
        type: dto.type,
        totalQuantity: dto.totalQuantity,
        remainingQuantity: dto.totalQuantity,
        maxPerUser: dto.maxPerUser,
        claimWindowMinutes: dto.claimWindowMinutes,
        startsAt,
        endsAt: dto.endsAt,
        createdById: store.userId,
        branches: {
          create: branchIds.map((branchId) => ({ branchId })),
        },
      },
      include: offerInclude,
    });
    return this.toDto(offer, undefined);
  }

  async update(
    storeId: string,
    offerId: string,
    dto: UpdateOfferDto,
  ): Promise<BusinessOfferDto> {
    const offer = await this.findInStore(storeId, offerId);
    assertEditable(offer.status);
    if (dto.endsAt) assertValidEnd(offer.startsAt, dto.endsAt);

    await this.prisma.offer.update({
      where: { id: offerId },
      data: dto,
    });
    return this.get(storeId, offerId);
  }

  /** Stops new claims. Existing reservations can still be redeemed. */
  pause(storeId: string, offerId: string) {
    return this.changeStatus(storeId, offerId, {
      from: [OfferStatus.ACTIVE],
      to: OfferStatus.PAUSED,
    });
  }

  async resume(store: StoreAccess, offerId: string) {
    assertStoreActive(store);
    const offer = await this.findInStore(store.storeId, offerId);
    if (offer.endsAt <= new Date()) {
      throw new BadRequestException(
        'This offer has already ended; extend endsAt first or post a new one',
      );
    }
    return this.changeStatus(store.storeId, offerId, {
      from: [OfferStatus.PAUSED],
      to: OfferStatus.ACTIVE,
    });
  }

  /** Ends the offer for good. Existing reservations can still be redeemed. */
  end(storeId: string, offerId: string) {
    return this.changeStatus(storeId, offerId, {
      from: [OfferStatus.ACTIVE, OfferStatus.PAUSED],
      to: OfferStatus.ENDED,
    });
  }

  private async changeStatus(
    storeId: string,
    offerId: string,
    { from, to }: { from: OfferStatus[]; to: OfferStatus },
  ): Promise<BusinessOfferDto> {
    const offer = await this.findInStore(storeId, offerId);
    assertEditable(offer.status);
    if (!from.includes(offer.status)) {
      throw new BadRequestException(
        `Cannot change an offer from ${offer.status} to ${to}`,
      );
    }
    // Conditional update, so two taps at once can't both succeed.
    const { count } = await this.prisma.offer.updateMany({
      where: { id: offerId, status: { in: from } },
      data: { status: to },
    });
    if (count === 0) {
      throw new BadRequestException(
        'The offer was changed meanwhile; reload it',
      );
    }
    return this.get(storeId, offerId);
  }

  private async findInStore(
    storeId: string,
    offerId: string,
  ): Promise<OfferWithRelations> {
    const offer = await this.prisma.offer.findFirst({
      where: { id: offerId, storeId },
      include: offerInclude,
    });
    if (!offer) throw new NotFoundException('Offer not found');
    return offer;
  }

  private async resolveBranches(
    storeId: string,
    requested: string[] | undefined,
  ): Promise<string[]> {
    const ids = requested ? [...new Set(requested)] : undefined;
    const branches = await this.prisma.branch.findMany({
      where: { storeId, isActive: true, id: ids ? { in: ids } : undefined },
      select: { id: true },
    });
    if (ids && branches.length !== ids.length) {
      throw new BadRequestException(
        'Some branches are not active branches of this store',
      );
    }
    if (branches.length === 0) {
      throw new BadRequestException('The store has no active branches');
    }
    return branches.map((branch) => branch.id);
  }

  private async claimCounts(
    offerIds: string[],
  ): Promise<Map<string, ClaimCountsDto>> {
    const result = new Map<string, ClaimCountsDto>();
    if (offerIds.length === 0) return result;
    const rows = await this.prisma.claim.groupBy({
      by: ['offerId', 'status'],
      where: { offerId: { in: offerIds } },
      _count: { _all: true },
    });
    for (const row of rows) {
      const counts = result.get(row.offerId) ?? emptyCounts();
      counts[statusKey(row.status)] = row._count._all;
      result.set(row.offerId, counts);
    }
    return result;
  }

  private toDto(
    offer: OfferWithRelations,
    counts: ClaimCountsDto | undefined,
  ): BusinessOfferDto {
    return {
      id: offer.id,
      productId: offer.productId,
      title: offer.title,
      description: offer.description,
      imageUrl: this.storage.url(offer.product.imagePath),
      thumbUrl: this.storage.url(offer.product.thumbPath),
      originalPrice: formatPrice(offer.originalPrice),
      offerPrice: formatPrice(offer.offerPrice),
      discountPercent: discountPercent(offer.originalPrice, offer.offerPrice),
      type: offer.type,
      status: offer.status,
      state: offerState(offer),
      totalQuantity: offer.totalQuantity,
      remainingQuantity: offer.remainingQuantity,
      maxPerUser: offer.maxPerUser,
      claimWindowMinutes: offer.claimWindowMinutes,
      startsAt: offer.startsAt,
      endsAt: offer.endsAt,
      branchIds: offer.branches.map((branch) => branch.branchId),
      viewCount: offer.viewCount,
      claims: counts ?? emptyCounts(),
      createdAt: offer.createdAt,
    };
  }
}

function assertStoreActive(store: StoreAccess): void {
  if (!store.storeIsActive) {
    throw new ForbiddenException(
      'Your store is disabled. Contact us to re-enable it.',
    );
  }
}

function assertEditable(status: OfferStatus): void {
  if (status === OfferStatus.REMOVED) {
    throw new ForbiddenException('This offer was taken down by an admin');
  }
  if (status === OfferStatus.ENDED) {
    throw new BadRequestException('This offer has ended');
  }
}

function assertValidEnd(startsAt: Date, endsAt: Date): void {
  if (endsAt.getTime() <= Date.now()) {
    throw new BadRequestException('End time must be in the future');
  }
  if (endsAt <= startsAt) {
    throw new BadRequestException('End time must be after the start time');
  }
  if (endsAt.getTime() - startsAt.getTime() > MAX_DURATION_MS) {
    throw new BadRequestException('Offers can last at most 30 days');
  }
}

function emptyCounts(): ClaimCountsDto {
  return { reserved: 0, redeemed: 0, expired: 0, cancelled: 0 };
}

function statusKey(status: ClaimStatus): keyof ClaimCountsDto {
  switch (status) {
    case ClaimStatus.RESERVED:
      return 'reserved';
    case ClaimStatus.REDEEMED:
      return 'redeemed';
    case ClaimStatus.EXPIRED:
      return 'expired';
    case ClaimStatus.CANCELLED:
      return 'cancelled';
  }
}
