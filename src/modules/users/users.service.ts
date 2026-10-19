import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { pageArgs, pageMeta } from '../../common/dto/pagination.dto.js';
import { normalizeLibyanPhone } from '../../common/utils/phone.js';
import { generateTemporaryPassword } from '../../common/utils/temporary-password.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma, User } from '../../generated/prisma/client.js';
import { toUserDto } from '../auth/auth.service.js';
import { PasswordService } from '../auth/password.service.js';
import { TokenService } from '../auth/token.service.js';
import type {
  AdminUserDto,
  ListUsersQueryDto,
  ResetPasswordResponseDto,
  UserListDto,
} from './dto/admin-users.dto.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async list(query: ListUsersQueryDto): Promise<UserListDto> {
    const where: Prisma.UserWhereInput = {
      role: query.role,
      isActive: query.isActive,
      OR: query.search ? searchConditions(query.search) : undefined,
    };
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items: users.map(toAdminUserDto), meta: pageMeta(query, total) };
  }

  async setStatus(
    userId: string,
    isActive: boolean,
    adminId: string,
  ): Promise<AdminUserDto> {
    if (userId === adminId && !isActive) {
      throw new BadRequestException('You cannot disable your own account');
    }
    await this.findOrThrow(userId);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });
    if (!isActive) await this.tokens.revokeAllForUser(userId);
    return toAdminUserDto(user);
  }

  /** For merchants and admins who forgot their password. */
  async resetPassword(userId: string): Promise<ResetPasswordResponseDto> {
    const user = await this.findOrThrow(userId);
    if (!user.passwordHash) {
      throw new BadRequestException(
        'This account signs in with Google/Apple and has no password',
      );
    }
    const temporaryPassword = generateTemporaryPassword();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await this.passwords.hash(temporaryPassword),
        mustChangePassword: true,
      },
    });
    await this.tokens.revokeAllForUser(userId);
    return { temporaryPassword };
  }

  private async findOrThrow(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}

function searchConditions(search: string): Prisma.UserWhereInput[] {
  const conditions: Prisma.UserWhereInput[] = [
    { name: { contains: search, mode: 'insensitive' } },
    { email: { contains: search, mode: 'insensitive' } },
  ];
  const phone = normalizeLibyanPhone(search);
  if (phone) conditions.push({ phone }, { contactPhone: phone });
  return conditions;
}

function toAdminUserDto(user: User): AdminUserDto {
  return {
    ...toUserDto(user),
    contactPhone: user.contactPhone,
    isActive: user.isActive,
    noShowCount: user.noShowCount,
    claimBannedUntil: user.claimBannedUntil,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}
