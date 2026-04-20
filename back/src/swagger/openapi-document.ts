import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function createOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Services App API')
    .setDescription(
      'Backend REST API. Авторизация email/password и JWT; дальнейшие домены — по мере появления модулей.',
    )
    .setVersion('1.0')
    .addServer('/v1', 'Префикс Nest `setGlobalPrefix("v1")`')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();

  return SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) => {
      const short = controllerKey.replace(/Controller$/, '');
      return `${short}_${methodKey}`;
    },
  });
}

export function mountSwaggerUi(
  app: INestApplication,
  document: ReturnType<typeof createOpenApiDocument>,
) {
  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
    jsonDocumentUrl: 'openapi.json',
    swaggerUiEnabled: true,
  });
}
