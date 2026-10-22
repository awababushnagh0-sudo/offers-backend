import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

const semver = z.string().regex(/^\d+\.\d+\.\d+$/, 'must look like 1.2.0');

const commaList = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    // Comma-separated list of allowed origins, e.g. "https://admin.example.ly".
    // Leave empty to allow all origins (fine for mobile apps in development).
    CORS_ORIGINS: commaList,
    SWAGGER_ENABLED: booleanString.default(true),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),

    // Generate with: openssl rand -base64 48
    JWT_ACCESS_SECRET: z.string().min(32),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

    // Comma-separated OAuth client IDs the ID tokens may be issued for
    // (Google: iOS, Android and web client IDs; Apple: the app bundle ID).
    GOOGLE_CLIENT_IDS: commaList,
    APPLE_CLIENT_IDS: commaList,

    // Where uploaded photos are saved, and the public URL they're served from.
    UPLOADS_DIR: z.string().default('./uploads'),
    PUBLIC_UPLOADS_URL: z.url().default('http://localhost:3000/uploads'),
    // Serve uploads from the API itself (development). In production Caddy
    // serves the uploads folder directly, so this is turned off.
    SERVE_UPLOADS: booleanString.default(true),

    // Apps older than these versions are told to update (semver, e.g. 1.2.0).
    PARTNER_APP_MIN_VERSION: semver.default('1.0.0'),
    CUSTOMER_APP_MIN_VERSION: semver.default('1.0.0'),
    ADMIN_APP_MIN_VERSION: semver.default('1.0.0'),

    // Enables POST /auth/dev/customer and the test logins in the seed.
    // Off unless explicitly turned on; refused in production.
    DEV_AUTH_ENABLED: booleanString.default(false),
  })
  .refine(
    (env) =>
      env.NODE_ENV !== 'production' ||
      !env.JWT_ACCESS_SECRET.includes('change-me'),
    {
      path: ['JWT_ACCESS_SECRET'],
      message: 'set a real secret in production (openssl rand -base64 48)',
    },
  )
  .refine((env) => env.NODE_ENV !== 'production' || !env.DEV_AUTH_ENABLED, {
    path: ['DEV_AUTH_ENABLED'],
    message: 'must be false in production',
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}
