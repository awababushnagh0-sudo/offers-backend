import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.validation.js';
import { API_PREFIX, configureApp } from './setup/app.setup.js';
import { SWAGGER_PATH, setupSwagger } from './setup/swagger.setup.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const config = app.get(ConfigService<Env, true>);
  const swaggerEnabled = config.get('SWAGGER_ENABLED', { infer: true });
  if (swaggerEnabled) {
    setupSwagger(app);
  }

  const port = config.get('PORT', { infer: true });
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`API running on http://localhost:${port}/${API_PREFIX}/v1`);
  if (swaggerEnabled) {
    logger.log(`Swagger docs on http://localhost:${port}/${SWAGGER_PATH}`);
  }
}
await bootstrap();
