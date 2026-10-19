import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { Category } from '../../generated/prisma/client.js';
import type {
  CategoryDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/category.dto.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list({ activeOnly }: { activeOnly: boolean }): Promise<CategoryDto[]> {
    const categories = await this.prisma.category.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    });
    return categories.map(toCategoryDto);
  }

  async create(dto: CreateCategoryDto): Promise<CategoryDto> {
    return toCategoryDto(await this.prisma.category.create({ data: dto }));
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryDto> {
    return toCategoryDto(
      await this.prisma.category.update({ where: { id }, data: dto }),
    );
  }
}

export function toCategoryDto(category: Category): CategoryDto {
  return {
    id: category.id,
    slug: category.slug,
    nameAr: category.nameAr,
    nameEn: category.nameEn,
    iconUrl: category.iconUrl,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
  };
}
