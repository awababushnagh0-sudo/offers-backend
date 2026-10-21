import { ApiProperty, OmitType, PartialType, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import {
  IsLibyanPhone,
  OptionalBooleanQuery,
} from '../../../common/validation/decorators.js';
import { City, StoreMemberRole } from '../../../generated/prisma/enums.js';

export class CreateBranchDto {
  /** @example "حي الأندلس" */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: City, enumName: 'City', example: City.TRIPOLI })
  @IsEnum(City)
  city: City;

  /** @example "Hay Al Andalus" */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  area?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  /** @example 32.871 */
  @IsLatitude()
  latitude: number;

  /** @example 13.115 */
  @IsLongitude()
  longitude: number;

  /** @example "0910000000" */
  @IsOptional()
  @IsLibyanPhone()
  phone?: string;

  /**
   * Opening hours per day.
   * @example { "sat": [{ "open": "08:00", "close": "23:00" }] }
   */
  @IsOptional()
  @IsObject()
  openingHours?: Record<string, unknown>;
}

export class UpdateBranchDto extends PartialType(CreateBranchDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class NewMerchantDto {
  /** @example "Ahmed" */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  /**
   * Their login. If a merchant with this phone exists, they're linked
   * instead of creating a new account.
   * @example "0911234567"
   */
  @IsLibyanPhone()
  phone: string;
}

export class CreateStoreDto {
  @IsUUID()
  categoryId: string;

  /** @example "حلويات الساحل" */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsLibyanPhone()
  phone?: string;

  /**
   * For customers to get in touch.
   * @example "hello@sahel-sweets.ly"
   */
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsUrl()
  facebookUrl?: string;

  @IsOptional()
  @IsUrl()
  instagramUrl?: string;

  @ValidateNested({ each: true })
  @Type(() => CreateBranchDto)
  @ArrayMinSize(1)
  branches: CreateBranchDto[];

  /** The store owner's account. */
  @ValidateNested()
  @Type(() => NewMerchantDto)
  owner: NewMerchantDto;
}

export class UpdateStoreDto extends PartialType(
  OmitType(CreateStoreDto, ['branches', 'owner'] as const),
) {
  /** Disabled stores are hidden from customers and can't post offers. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AddMemberDto extends NewMerchantDto {
  @ApiProperty({ enum: StoreMemberRole, enumName: 'StoreMemberRole' })
  @IsEnum(StoreMemberRole)
  role: StoreMemberRole;

  /** Limit staff to one branch. Leave empty for all branches. */
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class ListStoresQueryDto extends PaginationQueryDto {
  /** Search by store name. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @OptionalBooleanQuery()
  isActive?: boolean;
}

/** What a store owner can change themselves. Name and category are set by admins. */
export class UpdateStoreProfileDto extends PickType(UpdateStoreDto, [
  'description',
  'phone',
  'email',
  'facebookUrl',
  'instagramUrl',
] as const) {}

export enum StoreImageKind {
  LOGO = 'logo',
  COVER = 'cover',
}
