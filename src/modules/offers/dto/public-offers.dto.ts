import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PageMetaDto,
  PaginationQueryDto,
} from '../../../common/dto/pagination.dto.js';
import { OfferType } from '../../../generated/prisma/enums.js';
import { CategoryDto } from '../../categories/dto/category.dto.js';
import { OfferState } from '../offer-state.js';

export enum OfferSort {
  NEAREST = 'nearest',
  ENDING_SOON = 'ending_soon',
  NEWEST = 'newest',
  BIGGEST_DISCOUNT = 'biggest_discount',
}

/** The customer's location, to show distances. Send both or neither. */
export class LocationQueryDto {
  /** @example 32.8872 */
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  /** @example 13.1913 */
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;
}

export class BrowseOffersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  /** Only offers within this distance (needs lat/lng). Default 25 km. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  radiusKm?: number;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  /** Search offer titles and store names. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /** Default: nearest when lat/lng are sent, otherwise newest. */
  @ApiPropertyOptional({ enum: OfferSort, enumName: 'OfferSort' })
  @IsOptional()
  @IsEnum(OfferSort)
  sort?: OfferSort;
}

export class OfferStoreSummaryDto {
  id: string;
  name: string;
  logoUrl: string | null;
  category: CategoryDto;
}

export class PublicBranchDto {
  id: string;
  name: string;
  city: string;
  area: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  @ApiProperty({ type: 'object', nullable: true, additionalProperties: true })
  openingHours: Record<string, unknown> | null;
  /** Null when no location was sent. */
  distanceKm: number | null;
}

export class PublicOfferDto {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  thumbUrl: string | null;
  /** LD with 3 decimals */
  originalPrice: string;
  /** LD with 3 decimals */
  offerPrice: string;
  discountPercent: number;
  @ApiProperty({ enum: OfferType, enumName: 'OfferType' })
  type: OfferType;
  @ApiProperty({ enum: OfferState, enumName: 'OfferState' })
  state: OfferState;
  /** Pieces left (LIMITED offers only). */
  remainingQuantity: number | null;
  /** How long a reservation is held after claiming. */
  claimWindowMinutes: number;
  startsAt: Date;
  endsAt: Date;
  store: OfferStoreSummaryDto;
  /** The closest branch where this offer is valid (or the first one). */
  nearestBranch: PublicBranchDto;
  /** Number of branches where it's valid. */
  branchCount: number;
}

export class PublicOfferListDto {
  items: PublicOfferDto[];
  meta: PageMetaDto;
}

export class PublicOfferDetailDto extends PublicOfferDto {
  /** All branches where it's valid, closest first when a location is sent. */
  branches: PublicBranchDto[];
  /** The logged-in customer's active reservation for this offer, if any. */
  myActiveClaimId: string | null;
}
