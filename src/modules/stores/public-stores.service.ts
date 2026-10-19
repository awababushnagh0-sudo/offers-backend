import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../common/auth/auth-user.js';
import type { LatLng } from '../../common/utils/geo.js';
import { PrismaService } from '../../database/prisma.service.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { StorageService } from '../../storage/storage.service.js';
import { toCategoryDto } from '../categories/categories.service.js';
import {
  liveOfferWhere,
  PublicOffersService,
  toBranchDto,
} from '../offers/public-offers.service.js';
import type {
  FollowedStoreDto,
  PublicStoreDto,
} from './dto/public-stores.dto.js';

@Injectable()
export class PublicStoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly offers: PublicOffersService,
  ) {}

  async get(
    storeId: string,
    location: LatLng | undefined,
    viewer: AuthUser | undefined,
  ): Promise<PublicStoreDto> {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, isActive: true },
      include: {
        category: true,
        branches: { where: { isActive: true }, orderBy: { createdAt: 'asc' } },
        _count: { select: { followers: true } },
      },
    });
    if (!store) throw new NotFoundException('Store not found');

    const branches = store.branches.map((branch) =>
      toBranchDto(branch, location),
    );
    if (location) branches.sort((a, b) => a.distanceKm! - b.distanceKm!);

    const isCustomer = viewer?.role === UserRole.CUSTOMER;
    const follow = isCustomer
      ? await this.prisma.follow.findUnique({
          where: { userId_storeId: { userId: viewer.id, storeId } },
        })
      : null;

    return {
      id: store.id,
      name: store.name,
      description: store.description,
      logoUrl: this.storage.url(store.logoUrl),
      coverUrl: this.storage.url(store.coverUrl),
      phone: store.phone,
      facebookUrl: store.facebookUrl,
      instagramUrl: store.instagramUrl,
      category: toCategoryDto(store.category),
      branches,
      followerCount: store._count.followers,
      isFollowing: isCustomer ? follow !== null : null,
      offers: await this.offers.liveForStore(storeId, location),
    };
  }

  /** Safe to call twice. */
  async follow(userId: string, storeId: string): Promise<void> {
    const store = await this.prisma.store.count({
      where: { id: storeId, isActive: true },
    });
    if (store === 0) throw new NotFoundException('Store not found');
    await this.prisma.follow.upsert({
      where: { userId_storeId: { userId, storeId } },
      update: {},
      create: { userId, storeId },
    });
  }

  /** Safe to call twice. */
  async unfollow(userId: string, storeId: string): Promise<void> {
    await this.prisma.follow.deleteMany({ where: { userId, storeId } });
  }

  async followed(userId: string): Promise<FollowedStoreDto[]> {
    const follows = await this.prisma.follow.findMany({
      where: { userId, store: { isActive: true } },
      include: {
        store: {
          include: {
            category: true,
            _count: { select: { offers: { where: liveOfferWhere() } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return follows.map(({ store, createdAt }) => ({
      id: store.id,
      name: store.name,
      logoUrl: this.storage.url(store.logoUrl),
      category: toCategoryDto(store.category),
      liveOfferCount: store._count.offers,
      followedAt: createdAt,
    }));
  }
}
