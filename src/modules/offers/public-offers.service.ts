import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { pageMeta } from '../../common/dto/pagination.dto.js';
import { distanceKm, type LatLng, roundKm } from '../../common/utils/geo.js';
import { formatPrice } from '../../common/utils/money.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  ClaimStatus,
  OfferStatus,
  OfferType,
} from '../../generated/prisma/enums.js';
import { StorageService } from '../../storage/storage.service.js';
import { toCategoryDto } from '../categories/categories.service.js';
import {
  type BrowseOffersQueryDto,
  OfferSort,
  type PublicBranchDto,
  type PublicOfferDetailDto,
  type PublicOfferDto,
  type PublicOfferListDto,
} from './dto/public-offers.dto.js';
import { discountPercent, OfferState, offerState } from './offer-state.js';

const DEFAULT_RADIUS_KM = 25;
// Live offers are filtered and sorted in memory. Plenty for ~100 stores;
// move distance sorting into SQL if the app outgrows this.
const MAX_LIVE_OFFERS = 1000;

const publicOfferInclude = {
  store: { include: { category: true } },
  product: { select: { imagePath: true, thumbPath: true } },
  branches: { include: { branch: true } },
} satisfies Prisma.OfferInclude;

type PublicOffer = Prisma.OfferGetPayload<{
  include: typeof publicOfferInclude;
}>;

/** An offer with its active branches, closest first. */
interface RankedOffer {
  offer: PublicOffer;
  branches: PublicBranchDto[];
}

/** Offers that customers can claim right now. */
export function liveOfferWhere(now = new Date()): Prisma.OfferWhereInput {
  return {
    status: OfferStatus.ACTIVE,
    startsAt: { lte: now },
    endsAt: { gt: now },
    store: { isActive: true },
    OR: [{ type: OfferType.UNLIMITED }, { remainingQuantity: { gt: 0 } }],
    branches: { some: { branch: { isActive: true } } },
  };
}

@Injectable()
export class PublicOffersService {
  private readonly logger = new Logger(PublicOffersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async browse(query: BrowseOffersQueryDto): Promise<PublicOfferListDto> {
    const location = toLocation(query.lat, query.lng);
    if (query.radiusKm && !location) {
      throw new BadRequestException('radiusKm needs lat and lng');
    }
    const sort =
      query.sort ?? (location ? OfferSort.NEAREST : OfferSort.NEWEST);
    if (sort === OfferSort.NEAREST && !location) {
      throw new BadRequestException('Sorting by nearest needs lat and lng');
    }

    const search = query.search?.trim();
    const offers = await this.prisma.offer.findMany({
      where: {
        AND: [
          liveOfferWhere(),
          {
            storeId: query.storeId,
            store: query.categoryId
              ? { categoryId: query.categoryId }
              : undefined,
          },
          search
            ? {
                OR: [
                  { title: { contains: search, mode: 'insensitive' } },
                  {
                    store: { name: { contains: search, mode: 'insensitive' } },
                  },
                ],
              }
            : {},
        ],
      },
      include: publicOfferInclude,
      orderBy: { createdAt: 'desc' },
      take: MAX_LIVE_OFFERS,
    });
    if (offers.length === MAX_LIVE_OFFERS) {
      this.logger.warn(
        `Browsing hit ${MAX_LIVE_OFFERS} live offers; time to sort in SQL`,
      );
    }

    let ranked = offers
      .map((offer) => this.rank(offer, location))
      .filter((r) => r.branches.length > 0);

    if (location) {
      const radius = query.radiusKm ?? DEFAULT_RADIUS_KM;
      ranked = ranked.filter((r) => r.branches[0].distanceKm! <= radius);
    }
    ranked.sort(comparator(sort));

    const start = (query.page - 1) * query.pageSize;
    return {
      items: ranked
        .slice(start, start + query.pageSize)
        .map((r) => this.toDto(r)),
      meta: pageMeta(query, ranked.length),
    };
  }

  /**
   * Offer page. Ended or sold-out offers still open (e.g. from a shared link)
   * and show their state; removed offers and disabled stores are hidden.
   */
  async get(
    offerId: string,
    location: LatLng | undefined,
    viewerId: string | undefined,
  ): Promise<PublicOfferDetailDto> {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: publicOfferInclude,
    });
    if (
      !offer ||
      offer.status === OfferStatus.REMOVED ||
      !offer.store.isActive ||
      offer.startsAt > new Date()
    ) {
      throw new NotFoundException('Offer not found');
    }

    const ranked = this.rank(offer, location);
    if (ranked.branches.length === 0) {
      throw new NotFoundException('Offer not found');
    }

    if (offerState(offer) === OfferState.LIVE) {
      // Fire and forget: a lost view count is fine, a slow page isn't.
      this.prisma.offer
        .update({
          where: { id: offerId },
          data: { viewCount: { increment: 1 } },
        })
        .catch((error: unknown) =>
          this.logger.warn(`View count failed: ${String(error)}`),
        );
    }

    const myClaim = viewerId
      ? await this.prisma.claim.findFirst({
          where: {
            offerId,
            userId: viewerId,
            status: ClaimStatus.RESERVED,
            expiresAt: { gt: new Date() },
          },
          select: { id: true },
        })
      : null;

    return {
      ...this.toDto(ranked),
      branches: ranked.branches,
      myActiveClaimId: myClaim?.id ?? null,
    };
  }

  /** Live offers of one store, for the store page. */
  async liveForStore(
    storeId: string,
    location: LatLng | undefined,
  ): Promise<PublicOfferDto[]> {
    const offers = await this.prisma.offer.findMany({
      where: { AND: [liveOfferWhere(), { storeId }] },
      include: publicOfferInclude,
      orderBy: { endsAt: 'asc' },
      take: 100,
    });
    return offers
      .map((offer) => this.rank(offer, location))
      .filter((r) => r.branches.length > 0)
      .map((r) => this.toDto(r));
  }

  private rank(offer: PublicOffer, location: LatLng | undefined): RankedOffer {
    const branches = offer.branches
      .map(({ branch }) => branch)
      .filter((branch) => branch.isActive)
      .map((branch) => toBranchDto(branch, location));
    if (location) {
      branches.sort((a, b) => a.distanceKm! - b.distanceKm!);
    }
    return { offer, branches };
  }

  private toDto({ offer, branches }: RankedOffer): PublicOfferDto {
    return {
      id: offer.id,
      title: offer.title,
      description: offer.description,
      imageUrl: this.storage.url(offer.product.imagePath),
      thumbUrl: this.storage.url(offer.product.thumbPath),
      originalPrice: formatPrice(offer.originalPrice),
      offerPrice: formatPrice(offer.offerPrice),
      discountPercent: discountPercent(offer.originalPrice, offer.offerPrice),
      type: offer.type,
      state: offerState(offer),
      remainingQuantity:
        offer.type === OfferType.LIMITED ? offer.remainingQuantity : null,
      claimWindowMinutes: offer.claimWindowMinutes,
      startsAt: offer.startsAt,
      endsAt: offer.endsAt,
      store: {
        id: offer.store.id,
        name: offer.store.name,
        logoUrl: this.storage.url(offer.store.logoUrl),
        category: toCategoryDto(offer.store.category),
      },
      nearestBranch: branches[0],
      branchCount: branches.length,
    };
  }
}

export function toLocation(
  lat: number | undefined,
  lng: number | undefined,
): LatLng | undefined {
  if (lat === undefined && lng === undefined) return undefined;
  if (lat === undefined || lng === undefined) {
    throw new BadRequestException('Send both lat and lng, or neither');
  }
  return { latitude: lat, longitude: lng };
}

export function toBranchDto(
  branch: PublicOffer['branches'][number]['branch'],
  location: LatLng | undefined,
): PublicBranchDto {
  return {
    id: branch.id,
    name: branch.name,
    city: branch.city,
    area: branch.area,
    address: branch.address,
    latitude: branch.latitude,
    longitude: branch.longitude,
    phone: branch.phone,
    openingHours: branch.openingHours as Record<string, unknown> | null,
    distanceKm: location ? roundKm(distanceKm(location, branch)) : null,
  };
}

function comparator(sort: OfferSort) {
  return (a: RankedOffer, b: RankedOffer): number => {
    switch (sort) {
      case OfferSort.NEAREST:
        return a.branches[0].distanceKm! - b.branches[0].distanceKm!;
      case OfferSort.ENDING_SOON:
        return a.offer.endsAt.getTime() - b.offer.endsAt.getTime();
      case OfferSort.BIGGEST_DISCOUNT:
        return (
          discountPercent(b.offer.originalPrice, b.offer.offerPrice) -
          discountPercent(a.offer.originalPrice, a.offer.offerPrice)
        );
      case OfferSort.NEWEST:
        return b.offer.createdAt.getTime() - a.offer.createdAt.getTime();
    }
  };
}
