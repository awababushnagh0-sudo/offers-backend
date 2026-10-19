import { PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CategoryDto {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  iconUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

export class CreateCategoryDto {
  /**
   * Lowercase, used in URLs and filters.
   * @example "juice-bars"
   */
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase letters, numbers and dashes',
  })
  @MaxLength(50)
  slug: string;

  /** @example "عصائر" */
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nameAr: string;

  /** @example "Juice bars" */
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nameEn: string;

  @IsOptional()
  @IsUrl()
  iconUrl?: string;

  /** Lower numbers show first. */
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
  /** Hidden categories don't show in the apps. Categories can't be deleted. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
