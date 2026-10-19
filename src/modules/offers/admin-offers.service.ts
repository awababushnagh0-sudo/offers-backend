import { Injectable, NotFoundException } from '@nestjs/common';
import { pageArgs, pageMeta } from '../../common/dto/pagination.dto.js';
import { formatPrice } from '../../common/utils/money.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { ClaimStatus, OfferStatus } from '../../generated/prisma/enums.js';
import type {
  AdminOfferDto,
  ListOffersQueryDto,
  OfferListDto,
} from './dto/admin-offers.dto.js';

const adminOfferInclude = {
  store: { select: { id: true, name: true } },
  _count: { select: { claims: true } },
} satisfies Prisma.OfferInclude;

type OfferWithStore = Prisma.OfferGetPayload<{
  include: typeof adminOfferInclude;
}>;

@Injectable()
export class AdminOffersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListOffersQueryDto): Promise<OfferListDto> {
    const where: Prisma.OfferWhereInput = {
      storeId: query.storeId,
      status: query.status,
    };
    const [offers, total] = await this.prisma.$transaction([
      this.prisma.offer.findMany({
        where,
        include: adminOfferInclude,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.offer.count({ where }),
    ]);
    return { items: offers.map(toAdminOfferDto), meta: pageMeta(query, total) };
  }

  /** Takes an offer down and cancels the reservations customers are holding. */
  async remove(id: string): Promise<AdminOfferDto> {
    const exists = await this.prisma.offer.count({ where: { id } });
    if (exists === 0) throw new NotFoundException('Offer not found');

    const [offer] = await this.prisma.$transaction([
      this.prisma.offer.update({
        where: { id },
        data: { status: OfferStatus.REMOVED },
        include: adminOfferInclude,
      }),
      this.prisma.claim.updateMany({
        where: { offerId: id, status: ClaimStatus.RESERVED },
        data: { status: ClaimStatus.CANCELLED, cancelledAt: new Date() },
      }),
    ]);
    return toAdminOfferDto(offer);
  }
}

function toAdminOfferDto(offer: OfferWithStore): AdminOfferDto {
  return {
    id: offer.id,
    title: offer.title,
    store: offer.store,
    originalPrice: formatPrice(offer.originalPrice),
    offerPrice: formatPrice(offer.offerPrice),
    type: offer.type,
    status: offer.status,
    totalQuantity: offer.totalQuantity,
    remainingQuantity: offer.remainingQuantity,
    claimCount: offer._count.claims,
    startsAt: offer.startsAt,
    endsAt: offer.endsAt,
    createdAt: offer.createdAt,
  };
}
