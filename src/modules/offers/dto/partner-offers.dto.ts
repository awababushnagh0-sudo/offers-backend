import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
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
import { IsPrice } from '../../../common/validation/decorators.js';
import { OfferStatus, OfferType } from '../../../generated/prisma/enums.js';
import { OfferState } from '../offer-state.js';

export class CreateOfferDto {
  /** The product this offer is for. Its photo and regular price are used. */
  @IsUUID()
  productId: string;

  /**
   * Discounted price in LD. Must be lower than the product's regular price.
   * @example "4.000"
   */
  @IsPrice()
  offerPrice: string;

  @ApiProperty({ enum: OfferType, enumName: 'OfferType' })
  @IsEnum(OfferType)
  type: OfferType;

  /** Required for LIMITED offers, not allowed for UNLIMITED. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  totalQuantity?: number;

  /** How many times one customer can claim it. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxPerUser?: number;

  /** How long a claim is held before it expires (LIMITED offers). */
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(240)
  claimWindowMinutes?: number;

  /** Defaults to now. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startsAt?: Date;

  /** At most 30 days after the start. */
  @Type(() => Date)
  @IsDate()
  endsAt: Date;

  /** Branches where it's valid. Defaults to all active branches. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  branchIds?: string[];

  /** Defaults to the product title. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title?: string;

  /** Defaults to the product description. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class UpdateOfferDto extends PickType(CreateOfferDto, [
  'title',
  'description',
] as const) {
  /** Extend or shorten the offer. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endsAt?: Date;
}

export class ListPartnerOffersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: OfferStatus, enumName: 'OfferStatus' })
  @IsOptional()
  @IsEnum(OfferStatus)
  status?: OfferStatus;
}

export class ClaimCountsDto {
  reserved: number;
  redeemed: number;
  expired: number;
  cancelled: number;
}

export class PartnerOfferDto {
  id: string;
  productId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  thumbUrl: string | null;
  /** LD with 3 decimals, e.g. "8.000" */
  originalPrice: string;
  /** LD with 3 decimals, e.g. "4.000" */
  offerPrice: string;
  /** e.g. 50 for half price */
  discountPercent: number;
  @ApiProperty({ enum: OfferType, enumName: 'OfferType' })
  type: OfferType;
  @ApiProperty({ enum: OfferStatus, enumName: 'OfferStatus' })
  status: OfferStatus;
  /** What customers see right now. */
  @ApiProperty({ enum: OfferState, enumName: 'OfferState' })
  state: OfferState;
  totalQuantity: number | null;
  remainingQuantity: number | null;
  maxPerUser: number;
  claimWindowMinutes: number;
  startsAt: Date;
  endsAt: Date;
  branchIds: string[];
  viewCount: number;
  claims: ClaimCountsDto;
  createdAt: Date;
}

export class PartnerOfferListDto {
  items: PartnerOfferDto[];
  meta: PageMetaDto;
}
