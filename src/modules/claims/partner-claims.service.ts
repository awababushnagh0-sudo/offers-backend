import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { pageArgs, pageMeta } from '../../common/dto/pagination.dto.js';
import { normalizeClaimCode } from '../../common/utils/claim-code.js';
import { formatPrice } from '../../common/utils/money.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { ClaimStatus } from '../../generated/prisma/enums.js';
import { StorageService } from '../../storage/storage.service.js';
import type { StoreAccess } from '../stores/access/store-access.js';
import type {
  PartnerClaimDto,
  PartnerClaimListDto,
  ListPartnerClaimsQueryDto,
  RedeemClaimDto,
} from './dto/partner-claims.dto.js';

const claimInclude = {
  user: { select: { name: true } },
  offer: {
    select: {
      id: true,
      title: true,
      offerPrice: true,
      originalPrice: true,
      product: { select: { thumbPath: true } },
      branches: { select: { branchId: true } },
    },
  },
} satisfies Prisma.ClaimInclude;

type ClaimWithOffer = Prisma.ClaimGetPayload<{ include: typeof claimInclude }>;

/** The store side of claims: who's coming, looking up a code, redeeming it. */
@Injectable()
export class PartnerClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async list(
    store: StoreAccess,
    query: ListPartnerClaimsQueryDto,
  ): Promise<PartnerClaimListDto> {
    const status = query.status ?? ClaimStatus.RESERVED;
    const where: Prisma.ClaimWhereInput = {
      status,
      offer: {
        storeId: store.storeId,
        // Staff limited to a branch only see offers valid at their branch.
        branches: store.branchId
          ? { some: { branchId: store.branchId } }
          : undefined,
      },
    };
    const [claims, total] = await this.prisma.$transaction([
      this.prisma.claim.findMany({
        where,
        include: claimInclude,
        orderBy:
          status === ClaimStatus.RESERVED
            ? { expiresAt: 'asc' }
            : { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.claim.count({ where }),
    ]);
    return {
      items: claims.map((claim) => this.toDto(claim, store)),
      meta: pageMeta(query, total),
    };
  }

  /** What the cashier sees after scanning, before confirming. */
  async lookup(store: StoreAccess, code: string): Promise<PartnerClaimDto> {
    return this.toDto(await this.findByCode(store, code), store);
  }

  async redeem(
    store: StoreAccess,
    dto: RedeemClaimDto,
  ): Promise<PartnerClaimDto> {
    const claim = await this.findByCode(store, dto.code);
    const problem = redeemProblem(claim, store);
    if (problem) throw new ConflictException(problem);

    const branchId = this.resolveBranch(claim, store, dto.branchId);
    const now = new Date();
    // Conditional update: a code can only be redeemed once, even if two
    // cashiers scan it at the same moment.
    const { count } = await this.prisma.claim.updateMany({
      where: {
        id: claim.id,
        status: ClaimStatus.RESERVED,
        expiresAt: { gt: now },
      },
      data: {
        status: ClaimStatus.REDEEMED,
        redeemedAt: now,
        redeemedById: store.userId,
        redeemedBranchId: branchId,
      },
    });
    const updated = await this.findByCode(store, dto.code);
    if (count === 0) {
      throw new ConflictException(
        redeemProblem(updated, store) ?? 'This code can no longer be redeemed',
      );
    }
    return this.toDto(updated, store);
  }

  private async findByCode(
    store: StoreAccess,
    rawCode: string,
  ): Promise<ClaimWithOffer> {
    const claim = await this.prisma.claim.findFirst({
      where: {
        code: normalizeClaimCode(rawCode),
        offer: { storeId: store.storeId },
      },
      include: claimInclude,
    });
    if (!claim) {
      throw new NotFoundException('No claim with this code at your store');
    }
    return claim;
  }

  private resolveBranch(
    claim: ClaimWithOffer,
    store: StoreAccess,
    requested: string | undefined,
  ): string {
    const validBranches = claim.offer.branches.map((b) => b.branchId);
    const branchId =
      store.branchId ??
      requested ??
      (validBranches.length === 1 ? validBranches[0] : undefined);
    if (!branchId) {
      throw new BadRequestException(
        'Choose the branch where this is being redeemed',
      );
    }
    if (!validBranches.includes(branchId)) {
      throw new BadRequestException('This offer is not valid at this branch');
    }
    return branchId;
  }

  private toDto(claim: ClaimWithOffer, store: StoreAccess): PartnerClaimDto {
    const problem = redeemProblem(claim, store);
    return {
      id: claim.id,
      code: claim.code,
      status: claim.status,
      customerName: claim.user.name,
      offer: {
        id: claim.offer.id,
        title: claim.offer.title,
        offerPrice: formatPrice(claim.offer.offerPrice),
        originalPrice: formatPrice(claim.offer.originalPrice),
        thumbUrl: this.storage.url(claim.offer.product.thumbPath),
      },
      expiresAt: claim.expiresAt,
      redeemedAt: claim.redeemedAt,
      redeemedBranchId: claim.redeemedBranchId,
      createdAt: claim.createdAt,
      canRedeem: problem === null,
      problem,
    };
  }
}

function redeemProblem(
  claim: ClaimWithOffer,
  store: StoreAccess,
): string | null {
  switch (claim.status) {
    case ClaimStatus.REDEEMED:
      return `Already redeemed${claim.redeemedAt ? ` at ${claim.redeemedAt.toISOString()}` : ''}`;
    case ClaimStatus.CANCELLED:
      return 'This claim was cancelled';
    case ClaimStatus.EXPIRED:
      return 'This claim has expired';
  }
  if (claim.expiresAt <= new Date()) return 'This claim has expired';
  if (
    store.branchId &&
    !claim.offer.branches.some((b) => b.branchId === store.branchId)
  ) {
    return 'This offer is not valid at your branch';
  }
  return null;
}
