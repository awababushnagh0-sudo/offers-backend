import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { Env } from '../../config/env.validation.js';

export interface SocialProfile {
  providerUserId: string;
  /** Only set when the provider says the email is verified. */
  email?: string;
  name?: string;
  avatarUrl?: string;
}

// Public signing keys, fetched and cached by jose.
const GOOGLE_KEYS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs'),
);
const APPLE_KEYS = createRemoteJWKSet(
  new URL('https://appleid.apple.com/auth/keys'),
);

/** Verifies ID tokens the apps get from Google / Apple sign-in. */
@Injectable()
export class SocialTokenVerifier {
  private readonly googleClientIds: string[];
  private readonly appleClientIds: string[];

  constructor(config: ConfigService<Env, true>) {
    this.googleClientIds = config.get('GOOGLE_CLIENT_IDS', { infer: true });
    this.appleClientIds = config.get('APPLE_CLIENT_IDS', { infer: true });
  }

  async verifyGoogle(idToken: string): Promise<SocialProfile> {
    if (this.googleClientIds.length === 0) {
      throw new ServiceUnavailableException('Google sign-in is not configured');
    }
    const payload = await verifyOrThrow('Google', () =>
      jwtVerify(idToken, GOOGLE_KEYS, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: this.googleClientIds,
      }),
    );
    return {
      providerUserId: payload.sub!,
      email: isVerified(payload.email_verified)
        ? asString(payload.email)
        : undefined,
      name: asString(payload.name),
      avatarUrl: asString(payload.picture),
    };
  }

  async verifyApple(idToken: string): Promise<SocialProfile> {
    if (this.appleClientIds.length === 0) {
      throw new ServiceUnavailableException('Apple sign-in is not configured');
    }
    const payload = await verifyOrThrow('Apple', () =>
      jwtVerify(idToken, APPLE_KEYS, {
        issuer: 'https://appleid.apple.com',
        audience: this.appleClientIds,
      }),
    );
    // Apple never puts the name in the token; the app sends it separately.
    return {
      providerUserId: payload.sub!,
      email: isVerified(payload.email_verified)
        ? asString(payload.email)
        : undefined,
    };
  }
}

async function verifyOrThrow(
  provider: string,
  verify: () => Promise<{ payload: JWTPayload }>,
): Promise<JWTPayload> {
  try {
    const { payload } = await verify();
    if (!payload.sub) throw new Error('Missing sub');
    return payload;
  } catch {
    throw new UnauthorizedException(`Invalid ${provider} token`);
  }
}

// Apple sends email_verified as the string "true"; Google as a boolean.
function isVerified(value: unknown): boolean {
  return value === true || value === 'true';
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
