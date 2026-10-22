import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
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

/** The roles of our team on the admin dashboard. */
export const TEAM_ROLES = [UserRole.ADMIN, UserRole.EDITOR] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

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

export class ListTeamQueryDto extends OmitType(ListUsersQueryDto, [
  'role',
] as const) {
  /** Only admins or only editors; both when empty. */
  @ApiPropertyOptional({ enum: TEAM_ROLES, enumName: 'TeamRole' })
  @IsOptional()
  @IsIn(TEAM_ROLES)
  role?: TeamRole;
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

export class CreateDashboardUserDto {
  /** @example "Sara" */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  /**
   * Their login.
   * @example "sara@offers.ly"
   */
  @IsEmail()
  @MaxLength(255)
  email: string;

  /** Editors can't delete or take things down, and can't manage the team. */
  @ApiProperty({ enum: TEAM_ROLES, enumName: 'TeamRole' })
  @IsIn(TEAM_ROLES)
  role: TeamRole;
}

/** Their email is their login and stays as it is. */
export class UpdateDashboardUserDto extends PartialType(
  PickType(CreateDashboardUserDto, ['name', 'role'] as const),
) {}

export class CreatedDashboardUserDto {
  user: AdminUserDto;

  /** Shown only once. They must change it on their first login. */
  temporaryPassword: string;
}

export class ResetPasswordResponseDto {
  /** Shown only once. The user must change it on next login. */
  temporaryPassword: string;
}
