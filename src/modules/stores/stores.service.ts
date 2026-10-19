import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { pageArgs, pageMeta } from '../../common/dto/pagination.dto.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { StoreMemberRole } from '../../generated/prisma/enums.js';
import { toCategoryDto } from '../categories/categories.service.js';
import type {
  AddMemberDto,
  CreateBranchDto,
  CreateStoreDto,
  ListStoresQueryDto,
  UpdateBranchDto,
  UpdateStoreDto,
} from './dto/store-requests.dto.js';
import type {
  AddMemberResponseDto,
  BranchDto,
  CreateStoreResponseDto,
  StoreDetailDto,
  StoreListDto,
  StoreMemberDto,
} from './dto/store-responses.dto.js';
import { MerchantAccountsService } from './merchant-accounts.service.js';

const storeDetailInclude = {
  category: true,
  branches: { orderBy: { createdAt: 'asc' } },
  members: {
    include: { user: true },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  },
} satisfies Prisma.StoreInclude;

type StoreWithDetails = Prisma.StoreGetPayload<{
  include: typeof storeDetailInclude;
}>;
type MemberWithUser = StoreWithDetails['members'][number];

@Injectable()
export class StoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly merchants: MerchantAccountsService,
  ) {}

  async list(query: ListStoresQueryDto): Promise<StoreListDto> {
    const where: Prisma.StoreWhereInput = {
      name: query.search
        ? { contains: query.search, mode: 'insensitive' }
        : undefined,
      categoryId: query.categoryId,
      isActive: query.isActive,
    };
    const [stores, total] = await this.prisma.$transaction([
      this.prisma.store.findMany({
        where,
        include: { category: true, _count: { select: { branches: true } } },
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.store.count({ where }),
    ]);
    return {
      items: stores.map((store) => ({
        id: store.id,
        name: store.name,
        logoUrl: store.logoUrl,
        isActive: store.isActive,
        category: toCategoryDto(store.category),
        branchCount: store._count.branches,
        createdAt: store.createdAt,
      })),
      meta: pageMeta(query, total),
    };
  }

  async get(id: string): Promise<StoreDetailDto> {
    const store = await this.prisma.store.findUnique({
      where: { id },
      include: storeDetailInclude,
    });
    if (!store) throw new NotFoundException('Store not found');
    return toStoreDetailDto(store);
  }

  /** Creates the store, its branches and the owner account in one go. */
  async create(
    dto: CreateStoreDto,
    adminId: string,
  ): Promise<CreateStoreResponseDto> {
    await this.assertCategoryExists(dto.categoryId);
    const owner = await this.merchants.prepare(dto.owner);
    const { branches, owner: _owner, ...storeData } = dto;

    const store = await this.prisma.$transaction(async (tx) => {
      const user = await this.merchants.findOrCreate(tx, owner);
      return tx.store.create({
        data: {
          ...storeData,
          createdById: adminId,
          branches: { create: branches.map(toBranchData) },
          members: {
            create: { userId: user.id, role: StoreMemberRole.OWNER },
          },
        },
        include: storeDetailInclude,
      });
    });

    const ownerMember = store.members.find(
      (member) => member.role === StoreMemberRole.OWNER,
    )!;
    return {
      store: toStoreDetailDto(store),
      owner: {
        userId: ownerMember.userId,
        phone: owner.phone,
        temporaryPassword: owner.temporaryPassword,
      },
    };
  }

  async update(id: string, dto: UpdateStoreDto): Promise<StoreDetailDto> {
    await this.assertStoreExists(id);
    if (dto.categoryId) await this.assertCategoryExists(dto.categoryId);
    const store = await this.prisma.store.update({
      where: { id },
      data: dto,
      include: storeDetailInclude,
    });
    return toStoreDetailDto(store);
  }

  async addBranch(storeId: string, dto: CreateBranchDto): Promise<BranchDto> {
    await this.assertStoreExists(storeId);
    const branch = await this.prisma.branch.create({
      data: { ...toBranchData(dto), storeId },
    });
    return toBranchDto(branch);
  }

  async updateBranch(
    storeId: string,
    branchId: string,
    dto: UpdateBranchDto,
  ): Promise<BranchDto> {
    await this.assertBranchInStore(storeId, branchId);
    const { openingHours, ...rest } = dto;
    const branch = await this.prisma.branch.update({
      where: { id: branchId },
      data: {
        ...rest,
        openingHours: openingHours as Prisma.InputJsonValue | undefined,
      },
    });
    return toBranchDto(branch);
  }

  async addMember(
    storeId: string,
    dto: AddMemberDto,
  ): Promise<AddMemberResponseDto> {
    await this.assertStoreExists(storeId);
    if (dto.branchId) {
      if (dto.role === StoreMemberRole.OWNER) {
        throw new BadRequestException(
          'Owners manage the whole store; only staff can be limited to a branch',
        );
      }
      await this.assertBranchInStore(storeId, dto.branchId);
    }

    const prepared = await this.merchants.prepare(dto);
    if (prepared.existing) {
      const alreadyMember = await this.prisma.storeMember.findUnique({
        where: {
          storeId_userId: { storeId, userId: prepared.existing.id },
        },
      });
      if (alreadyMember) {
        throw new ConflictException('Already a member of this store');
      }
    }

    const member = await this.prisma.$transaction(async (tx) => {
      const user = await this.merchants.findOrCreate(tx, prepared);
      return tx.storeMember.create({
        data: {
          storeId,
          userId: user.id,
          role: dto.role,
          branchId: dto.branchId,
        },
        include: { user: true },
      });
    });

    return {
      member: toMemberDto(member),
      account: {
        userId: member.userId,
        phone: prepared.phone,
        temporaryPassword: prepared.temporaryPassword,
      },
    };
  }

  async removeMember(storeId: string, userId: string): Promise<void> {
    const member = await this.prisma.storeMember.findUnique({
      where: { storeId_userId: { storeId, userId } },
    });
    if (!member) throw new NotFoundException('Member not found');

    if (member.role === StoreMemberRole.OWNER) {
      const owners = await this.prisma.storeMember.count({
        where: { storeId, role: StoreMemberRole.OWNER },
      });
      if (owners <= 1) {
        throw new BadRequestException('A store needs at least one owner');
      }
    }
    await this.prisma.storeMember.delete({ where: { id: member.id } });
  }

  private async assertStoreExists(id: string): Promise<void> {
    const count = await this.prisma.store.count({ where: { id } });
    if (count === 0) throw new NotFoundException('Store not found');
  }

  private async assertCategoryExists(id: string): Promise<void> {
    const count = await this.prisma.category.count({ where: { id } });
    if (count === 0) throw new BadRequestException('Category not found');
  }

  private async assertBranchInStore(
    storeId: string,
    branchId: string,
  ): Promise<void> {
    const count = await this.prisma.branch.count({
      where: { id: branchId, storeId },
    });
    if (count === 0) throw new NotFoundException('Branch not found');
  }
}

function toBranchData(dto: CreateBranchDto) {
  return {
    ...dto,
    openingHours: dto.openingHours as Prisma.InputJsonValue | undefined,
  };
}

function toBranchDto(branch: StoreWithDetails['branches'][number]): BranchDto {
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
    isActive: branch.isActive,
  };
}

function toMemberDto(member: MemberWithUser): StoreMemberDto {
  return {
    userId: member.userId,
    name: member.user.name,
    phone: member.user.phone,
    role: member.role,
    branchId: member.branchId,
    isActive: member.user.isActive,
    mustChangePassword: member.user.mustChangePassword,
  };
}

function toStoreDetailDto(store: StoreWithDetails): StoreDetailDto {
  return {
    id: store.id,
    name: store.name,
    description: store.description,
    logoUrl: store.logoUrl,
    coverUrl: store.coverUrl,
    phone: store.phone,
    facebookUrl: store.facebookUrl,
    instagramUrl: store.instagramUrl,
    isActive: store.isActive,
    createdAt: store.createdAt,
    category: toCategoryDto(store.category),
    branches: store.branches.map(toBranchDto),
    members: store.members.map(toMemberDto),
  };
}
