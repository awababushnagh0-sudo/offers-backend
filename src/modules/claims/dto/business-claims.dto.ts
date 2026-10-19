import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  PageMetaDto,
  PaginationQueryDto,
} from '../../../common/dto/pagination.dto.js';
import { ClaimStatus } from '../../../generated/prisma/enums.js';

export class RedeemClaimDto {
  /**
   * The code from the customer's QR code (or typed in).
   * @example "ABCD2345"
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  /**
   * The branch where it's redeemed. Not needed for staff limited to one
   * branch, or when the offer is valid at only one branch.
   */
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class ListBusinessClaimsQueryDto extends PaginationQueryDto {
  /** Defaults to RESERVED: customers who are on their way. */
  @ApiPropertyOptional({ enum: ClaimStatus, enumName: 'ClaimStatus' })
  @IsOptional()
  @IsEnum(ClaimStatus)
  status?: ClaimStatus;
}

export class ClaimOfferDto {
  id: string;
  title: string;
  /** LD with 3 decimals */
  offerPrice: string;
  /** LD with 3 decimals */
  originalPrice: string;
  thumbUrl: string | null;
}

export class BusinessClaimDto {
  id: string;
  code: string;
  @ApiProperty({ enum: ClaimStatus, enumName: 'ClaimStatus' })
  status: ClaimStatus;
  customerName: string | null;
  offer: ClaimOfferDto;
  expiresAt: Date;
  redeemedAt: Date | null;
  redeemedBranchId: string | null;
  createdAt: Date;
  /** True if it can be redeemed right now at this store. */
  canRedeem: boolean;
  /** Why it can't be redeemed, to show the cashier. */
  problem: string | null;
}

export class BusinessClaimListDto {
  items: BusinessClaimDto[];
  meta: PageMetaDto;
}
