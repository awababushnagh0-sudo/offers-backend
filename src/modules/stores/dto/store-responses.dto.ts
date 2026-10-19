import { ApiProperty } from '@nestjs/swagger';
import { PageMetaDto } from '../../../common/dto/pagination.dto.js';
import { StoreMemberRole } from '../../../generated/prisma/enums.js';
import { CategoryDto } from '../../categories/dto/category.dto.js';

export class BranchDto {
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
  isActive: boolean;
}

export class StoreMemberDto {
  userId: string;
  name: string | null;
  phone: string | null;
  @ApiProperty({ enum: StoreMemberRole, enumName: 'StoreMemberRole' })
  role: StoreMemberRole;
  branchId: string | null;
  /** False if the account has been disabled. */
  isActive: boolean;
  /** Still using the temporary password. */
  mustChangePassword: boolean;
}

export class StoreDetailDto {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  phone: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  category: CategoryDto;
  branches: BranchDto[];
  members: StoreMemberDto[];
}

export class StoreListItemDto {
  id: string;
  name: string;
  logoUrl: string | null;
  isActive: boolean;
  category: CategoryDto;
  branchCount: number;
  createdAt: Date;
}

export class StoreListDto {
  items: StoreListItemDto[];
  meta: PageMetaDto;
}

export class NewAccountDto {
  userId: string;
  phone: string;
  /**
   * Shown only once. Null if the phone already had a merchant account,
   * which was linked instead.
   */
  temporaryPassword: string | null;
}

export class CreateStoreResponseDto {
  store: StoreDetailDto;
  owner: NewAccountDto;
}

export class AddMemberResponseDto {
  member: StoreMemberDto;
  account: NewAccountDto;
}
