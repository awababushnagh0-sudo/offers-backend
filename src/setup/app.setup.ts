import {
  type INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter.js';
import type { Env } from '../config/env.validation.js';
import { StorageService } from '../storage/storage.service.js';

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
      // Lets the admin dashboard (another origin) show uploaded photos.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  if (config.get('SERVE_UPLOADS', { infer: true })) {
    (app as NestExpressApplication).useStaticAssets(
      app.get(StorageService).rootDir,
      { prefix: '/uploads/', index: false, dotfiles: 'deny', maxAge: '7d' },
    );
  }

  const origins = config.get('CORS_ORIGINS', { infer: true });
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
