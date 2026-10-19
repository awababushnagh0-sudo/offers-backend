import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

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
