import { Injectable, NotFoundException } from '@nestjs/common';
import { pageArgs, pageMeta } from '../../common/dto/pagination.dto.js';
import { formatPrice } from '../../common/utils/money.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma, Product } from '../../generated/prisma/client.js';
import { StorageService } from '../../storage/storage.service.js';
import type {
  CreateProductDto,
  ListProductsQueryDto,
  ProductDto,
  ProductListDto,
  UpdateProductDto,
} from './dto/products.dto.js';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async list(
    storeId: string,
    query: ListProductsQueryDto,
  ): Promise<ProductListDto> {
    const where: Prisma.ProductWhereInput = {
      storeId,
      isArchived: query.archived ?? false,
      title: query.search
        ? { contains: query.search, mode: 'insensitive' }
        : undefined,
    };
    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.product.count({ where }),
    ]);
    return {
      items: products.map((product) => this.toDto(product)),
      meta: pageMeta(query, total),
    };
  }

  async get(storeId: string, productId: string): Promise<ProductDto> {
    return this.toDto(await this.findInStore(storeId, productId));
  }

  async create(storeId: string, dto: CreateProductDto): Promise<ProductDto> {
    const product = await this.prisma.product.create({
      data: { ...dto, storeId },
    });
    return this.toDto(product);
  }

  async update(
    storeId: string,
    productId: string,
    dto: UpdateProductDto,
  ): Promise<ProductDto> {
    await this.findInStore(storeId, productId);
    const product = await this.prisma.product.update({
      where: { id: productId },
      data: dto,
    });
    return this.toDto(product);
  }

  /** Replaces the product photo (full size + thumbnail) and deletes the old files. */
  async setImage(
    storeId: string,
    productId: string,
    image: Express.Multer.File,
    thumb: Express.Multer.File,
  ): Promise<ProductDto> {
    const product = await this.findInStore(storeId, productId);
    const folder = `products/${storeId}`;
    const imagePath = await this.storage.saveImage(folder, image);
    const thumbPath = await this.storage
      .saveImage(folder, thumb)
      .catch(async (error: unknown) => {
        await this.storage.delete(imagePath);
        throw error;
      });
    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { imagePath, thumbPath },
    });
    await this.storage.delete(product.imagePath);
    await this.storage.delete(product.thumbPath);
    return this.toDto(updated);
  }

  async findInStore(storeId: string, productId: string): Promise<Product> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  toDto(product: Product): ProductDto {
    return {
      id: product.id,
      title: product.title,
      description: product.description,
      regularPrice: formatPrice(product.regularPrice),
      imageUrl: this.storage.url(product.imagePath),
      thumbUrl: this.storage.url(product.thumbPath),
      isArchived: product.isArchived,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
