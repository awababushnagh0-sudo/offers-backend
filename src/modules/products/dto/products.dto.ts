import { PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  PageMetaDto,
  PaginationQueryDto,
} from '../../../common/dto/pagination.dto.js';
import {
  IsPrice,
  OptionalBooleanQuery,
} from '../../../common/validation/decorators.js';

export class CreateProductDto {
  /** @example "كيكة كراميل" */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  /**
   * Normal price in LD.
   * @example "8.000"
   */
  @IsPrice()
  regularPrice: string;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {
  /** Archived products are hidden from the list but keep their history. */
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}

export class ListProductsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /** Show archived products instead of active ones. */
  @OptionalBooleanQuery()
  archived?: boolean;
}

export class ProductDto {
  id: string;
  title: string;
  description: string | null;
  /** LD with 3 decimals, e.g. "8.000" */
  regularPrice: string;
  imageUrl: string | null;
  thumbUrl: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ProductListDto {
  items: ProductDto[];
  meta: PageMetaDto;
}
