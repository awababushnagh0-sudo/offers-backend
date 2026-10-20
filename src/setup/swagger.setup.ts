import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'docs';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Offers API')
    .setDescription(
      'Backend for the customer app, business app and admin dashboard',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    // Operation names become method names in the generated app clients
    // (e.g. `login` instead of `AuthController_login_v1`). They only need
    // to be unique within one controller.
    operationIdFactory: (_controllerKey, methodKey) => methodKey,
  });
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    jsonDocumentUrl: `${SWAGGER_PATH}/json`,
    swaggerOptions: { persistAuthorization: true },
  });
}
