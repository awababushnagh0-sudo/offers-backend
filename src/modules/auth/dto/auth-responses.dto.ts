import { ApiProperty } from '@nestjs/swagger';
import { StoreMemberRole, UserRole } from '../../../generated/prisma/enums.js';

export class UserDto {
  id: string;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  role: UserRole;

  name: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;

  /** True for merchants who still have the temporary password from onboarding. */
  mustChangePassword: boolean;
}

export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime in seconds. */
  expiresIn: number;
  user: UserDto;
}

export class MembershipStoreDto {
  id: string;
  name: string;
  logoUrl: string | null;
}

export class MembershipDto {
  @ApiProperty({ enum: StoreMemberRole, enumName: 'StoreMemberRole' })
  role: StoreMemberRole;

  /** Null means the member works at all branches. */
  branchId: string | null;

  store: MembershipStoreDto;
}

export class MeDto extends UserDto {
  contactPhone: string | null;
  /** Stores this user works at (merchants only). */
  memberships: MembershipDto[];
}
