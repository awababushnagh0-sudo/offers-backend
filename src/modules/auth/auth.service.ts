import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { normalizeLibyanPhone } from '../../common/utils/phone.js';
import type { Env } from '../../config/env.validation.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { User } from '../../generated/prisma/client.js';
import { AuthProvider, UserRole } from '../../generated/prisma/enums.js';
import type {
  AuthResponseDto,
  MeDto,
  UserDto,
} from './dto/auth-responses.dto.js';
import { PasswordService } from './password.service.js';
import type { SocialProfile } from './social-token.verifier.js';
import { TokenService } from './token.service.js';

const STAFF_ROLES: UserRole[] = [UserRole.MERCHANT, UserRole.ADMIN];

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly passwords: PasswordService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Customer sign-in with Google or Apple. Creates the account on first use. */
  async signInWithSocial(
    provider: AuthProvider,
    profile: SocialProfile,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const identity = await this.prisma.authIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId: profile.providerUserId,
        },
      },
      include: { user: true },
    });

    const user = identity
      ? identity.user
      : await this.createOrLinkCustomer(provider, profile);

    return this.completeLogin(user, userAgent);
  }

  /** Merchant (phone) or admin (email) login with a password. */
  async loginWithPassword(
    identifier: string,
    password: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const user = await this.findStaffUser(identifier);
    const valid = await this.passwords.verify(user?.passwordHash, password);
    if (!user || !valid) {
      throw new UnauthorizedException('Wrong phone/email or password');
    }
    return this.completeLogin(user, userAgent);
  }

  async refresh(
    refreshToken: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const { user, tokens } = await this.tokens.rotate(refreshToken, userAgent);
    return { ...tokens, user: toUserDto(user) };
  }

  logout(refreshToken: string): Promise<void> {
    return this.tokens.revoke(refreshToken);
  }

  /** Changes the password and logs out all other sessions. */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!user.passwordHash) {
      throw new ForbiddenException('This account signs in with Google/Apple');
    }
    if (!(await this.passwords.verify(user.passwordHash, currentPassword))) {
      throw new UnauthorizedException('Current password is wrong');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await this.passwords.hash(newPassword),
        mustChangePassword: false,
      },
    });
    await this.tokens.revokeAllForUser(userId);
    const tokens = await this.tokens.issue(updated, userAgent);
    return { ...tokens, user: toUserDto(updated) };
  }

  async me(userId: string): Promise<MeDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            store: { select: { id: true, name: true, logoUrl: true } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    return {
      ...toUserDto(user),
      contactPhone: user.contactPhone,
      memberships: user.memberships.map(({ role, branchId, store }) => ({
        role,
        branchId,
        store,
      })),
    };
  }

  /**
   * Development only: log in as a test customer without Google/Apple,
   * so customer endpoints can be tried in Swagger.
   */
  async devCustomerLogin(
    name = 'Test Customer',
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    if (!this.config.get('DEV_AUTH_ENABLED', { infer: true })) {
      throw new NotFoundException();
    }
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'customer';
    const email = `${slug}@dev.local`;
    const user = await this.prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name, role: UserRole.CUSTOMER },
    });
    return this.completeLogin(user, userAgent);
  }

  private async createOrLinkCustomer(
    provider: AuthProvider,
    profile: SocialProfile,
  ): Promise<User> {
    const identityData = {
      provider,
      providerUserId: profile.providerUserId,
      email: profile.email,
    };

    // Same verified email from the other provider (e.g. Google, then Apple):
    // link to the existing customer instead of creating a second account.
    if (profile.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: profile.email },
      });
      if (existing?.role === UserRole.CUSTOMER) {
        await this.prisma.authIdentity.create({
          data: { ...identityData, userId: existing.id },
        });
        return existing;
      }
      // The email belongs to a merchant/admin: never link those. Create a
      // separate customer account without the email (emails are unique).
      if (existing) profile = { ...profile, email: undefined };
    }

    return this.prisma.user.create({
      data: {
        role: UserRole.CUSTOMER,
        name: profile.name,
        email: profile.email,
        avatarUrl: profile.avatarUrl,
        identities: { create: identityData },
      },
    });
  }

  private findStaffUser(identifier: string): Promise<User | null> {
    const value = identifier.trim();
    if (value.includes('@')) {
      return this.prisma.user.findFirst({
        where: { email: value.toLowerCase(), role: { in: STAFF_ROLES } },
      });
    }
    const phone = normalizeLibyanPhone(value);
    if (!phone) return Promise.resolve(null);
    return this.prisma.user.findFirst({
      where: { phone, role: { in: STAFF_ROLES } },
    });
  }

  private async completeLogin(
    user: User,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    if (!user.isActive) {
      throw new ForbiddenException('Account is disabled');
    }
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    const tokens = await this.tokens.issue(updated, userAgent);
    return { ...tokens, user: toUserDto(updated) };
  }
}

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    mustChangePassword: user.mustChangePassword,
  };
}
