import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  PageMetaDto,
  PaginationQueryDto,
} from '../../../common/dto/pagination.dto.js';
import { OptionalBooleanQuery } from '../../../common/validation/decorators.js';
import { UserRole } from '../../../generated/prisma/enums.js';
import { UserDto } from '../../auth/dto/auth-responses.dto.js';

export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: UserRole, enumName: 'UserRole' })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  /** Search by name, email or phone. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @OptionalBooleanQuery()
  isActive?: boolean;
}

export class AdminUserDto extends UserDto {
  contactPhone: string | null;
  isActive: boolean;
  noShowCount: number;
  claimBannedUntil: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export class UserListDto {
  items: AdminUserDto[];
  meta: PageMetaDto;
}

export class SetUserStatusDto {
  /** False disables the account and logs it out everywhere. */
  @ApiProperty()
  @IsBoolean()
  isActive: boolean;
}

export class ResetPasswordResponseDto {
  /** Shown only once. The user must change it on next login. */
  temporaryPassword: string;
}
