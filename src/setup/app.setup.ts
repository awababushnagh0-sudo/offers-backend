import {
  type INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter.js';
import type { Env } from '../config/env.validation.js';

export const API_PREFIX = 'api';

/**
 * Global app configuration, shared by main.ts and the e2e tests so both run
 * the app exactly the same way.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<Env, true>);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // HTTPS is handled by Caddy in production. Upgrading requests here
          // breaks the Swagger UI on http://localhost (blank page).
          upgradeInsecureRequests: null,
        },
      },
    }),
  );

  const origins = config
    .get('CORS_ORIGINS', { infer: true })
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins.length > 0 ? origins : true });

  // Routes look like /api/v1/health
  app.setGlobalPrefix(API_PREFIX);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
}
