import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import {
  PageMetaDto,
  PaginationQueryDto,
} from '../../../common/dto/pagination.dto.js';
import { OfferStatus, OfferType } from '../../../generated/prisma/enums.js';

export class ListOffersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ enum: OfferStatus, enumName: 'OfferStatus' })
  @IsOptional()
  @IsEnum(OfferStatus)
  status?: OfferStatus;
}

export class OfferStoreDto {
  id: string;
  name: string;
}

export class AdminOfferDto {
  id: string;
  title: string;
  store: OfferStoreDto;
  /** LD with 3 decimals, e.g. "8.000" */
  originalPrice: string;
  /** LD with 3 decimals, e.g. "4.000" */
  offerPrice: string;
  @ApiProperty({ enum: OfferType, enumName: 'OfferType' })
  type: OfferType;
  @ApiProperty({ enum: OfferStatus, enumName: 'OfferStatus' })
  status: OfferStatus;
  totalQuantity: number | null;
  remainingQuantity: number | null;
  claimCount: number;
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
}

export class OfferListDto {
  items: AdminOfferDto[];
  meta: PageMetaDto;
}
