import {
  BadRequestException,
  ConflictException,
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
import type { UserRole } from '../../generated/prisma/enums.js';
import { TEAM_ROLES, type TeamRole } from './dto/admin-users.dto.js';
import type {
  AdminUserDto,
  CreateDashboardUserDto,
  CreatedDashboardUserDto,
  ListTeamQueryDto,
  UpdateDashboardUserDto,
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

  list(query: ListUsersQueryDto): Promise<UserListDto> {
    return this.findPage(query, query.role);
  }

  /** Our team on the dashboard: admins and editors. */
  listTeam(query: ListTeamQueryDto): Promise<UserListDto> {
    return this.findPage(query, query.role ?? { in: [...TEAM_ROLES] });
  }

  private async findPage(
    query: Omit<ListUsersQueryDto, 'role'>,
    role: Prisma.UserWhereInput['role'],
  ): Promise<UserListDto> {
    const where: Prisma.UserWhereInput = {
      role,
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

  /**
   * Adds someone to our team with a temporary password, which they must
   * change on their first login.
   */
  async createDashboardUser(
    dto: CreateDashboardUserDto,
  ): Promise<CreatedDashboardUserDto> {
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException({
        statusCode: 409,
        error: 'EmailTaken',
        message: 'This email already has an account',
      });
    }
    const temporaryPassword = generateTemporaryPassword();
    const user = await this.prisma.user.create({
      data: {
        role: dto.role,
        name: dto.name.trim(),
        email,
        passwordHash: await this.passwords.hash(temporaryPassword),
        mustChangePassword: true,
      },
    });
    return { user: toAdminUserDto(user), temporaryPassword };
  }

  async get(id: string): Promise<AdminUserDto> {
    return toAdminUserDto(await this.findOrThrow(id));
  }

  /** Renames someone on our team or changes their role. */
  async updateDashboardUser(
    userId: string,
    dto: UpdateDashboardUserDto,
    adminId: string,
  ): Promise<AdminUserDto> {
    const user = await this.findOrThrow(userId);
    if (!isTeamRole(user.role)) {
      throw new BadRequestException('Only admins and editors are edited here');
    }
    // An admin who made themselves an editor couldn't undo it.
    if (userId === adminId && dto.role && dto.role !== user.role) {
      throw new BadRequestException('You cannot change your own role');
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name?.trim(), role: dto.role },
    });
    return toAdminUserDto(updated);
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

function isTeamRole(role: UserRole): role is TeamRole {
  return (TEAM_ROLES as readonly UserRole[]).includes(role);
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
