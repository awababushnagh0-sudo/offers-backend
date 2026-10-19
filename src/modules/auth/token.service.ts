import { createHash, randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenPayload } from '../../common/auth/auth-user.js';
import type { Env } from '../../config/env.validation.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { User } from '../../generated/prisma/client.js';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime in seconds. */
  expiresIn: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const REUSE_GRACE_MS = 30 * 1000;

/**
 * Access tokens are short-lived JWTs. Refresh tokens are random strings
 * stored hashed; each one can be used once and is replaced on refresh.
 * Reusing an old refresh token logs the user out everywhere, since it
 * means the token was probably stolen.
 */
@Injectable()
export class TokenService {
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService<Env, true>,
  ) {
    this.accessTtlSeconds = config.get('ACCESS_TOKEN_TTL_SECONDS', {
      infer: true,
    });
    this.refreshTtlMs =
      config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) * DAY_MS;
  }

  async issue(
    user: Pick<User, 'id' | 'role'>,
    userAgent?: string,
  ): Promise<IssuedTokens> {
    const refreshToken = generateRefreshToken();
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
        userAgent,
      },
    });
    return {
      accessToken: await this.signAccessToken(user),
      refreshToken,
      expiresIn: this.accessTtlSeconds,
    };
  }

  /** Exchanges a refresh token for a new pair. Returns the user it belongs to. */
  async rotate(refreshToken: string, userAgent?: string) {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: true },
    });
    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (existing.revokedAt) {
      // A rotated token used again after the grace period means it leaked.
      // Within the grace period it's most likely an app retry, so just reject.
      const revokedAgoMs = Date.now() - existing.revokedAt.getTime();
      if (existing.replacedById && revokedAgoMs > REUSE_GRACE_MS) {
        await this.revokeAllForUser(existing.userId);
      }
      throw new UnauthorizedException('Refresh token has been revoked');
    }
    if (existing.expiresAt <= new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }
    if (!existing.user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    const newToken = generateRefreshToken();
    await this.prisma.$transaction(async (tx) => {
      // Only succeeds once, even if the app sends two refreshes at the same time.
      const { count } = await tx.refreshToken.updateMany({
        where: { id: existing.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (count === 0) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }
      const created = await tx.refreshToken.create({
        data: {
          userId: existing.userId,
          tokenHash: hashToken(newToken),
          expiresAt: new Date(Date.now() + this.refreshTtlMs),
          userAgent,
        },
      });
      await tx.refreshToken.update({
        where: { id: existing.id },
        data: { replacedById: created.id },
      });
    });

    const tokens: IssuedTokens = {
      accessToken: await this.signAccessToken(existing.user),
      refreshToken: newToken,
      expiresIn: this.accessTtlSeconds,
    };
    return { user: existing.user, tokens };
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private signAccessToken(user: Pick<User, 'id' | 'role'>): Promise<string> {
    const payload: AccessTokenPayload = { sub: user.id, role: user.role };
    return this.jwt.signAsync(payload, { expiresIn: this.accessTtlSeconds });
  }
}

function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
