import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { BOOKING_STATUS_SWAGGER_ENUM_DESCRIPTIONS } from '../modules/bookings/domain/booking-status-all-ordered';

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

  const document = SwaggerModule.createDocument(app, config, {
    /**
     * Иначе пути в спецификации уже содержат `/v1` (из `setGlobalPrefix`), а `addServer('/v1')`
     * даёт второй префикс — в Swagger UI получается `/v1/v1/...`.
     */
    ignoreGlobalPrefix: true,
    operationIdFactory: (controllerKey: string, methodKey: string) => {
      const short = controllerKey.replace(/Controller$/, '');
      return `${short}_${methodKey}`;
    },
  });

  const devStatusSchema = document.components?.schemas
    ?.DevBookingStatusValue as Record<string, unknown> | undefined;
  if (
    devStatusSchema &&
    Array.isArray(devStatusSchema.enum) &&
    devStatusSchema.enum.length ===
      BOOKING_STATUS_SWAGGER_ENUM_DESCRIPTIONS.length
  ) {
    devStatusSchema['x-enum-descriptions'] = [
      ...BOOKING_STATUS_SWAGGER_ENUM_DESCRIPTIONS,
    ];
  }

  return document;
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
