import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { BOOKING_STATUS_SWAGGER_ENUM_DESCRIPTIONS } from '../modules/bookings/domain/booking-status-all-ordered';

/** Порядок секций в Swagger UI и краткие описания категорий (глобальный `tags` в OpenAPI 3). */
const SWAGGER_TAG_ORDER_AND_DESCRIPTIONS: readonly {
  readonly name: string;
  readonly description: string;
}[] = [
  {
    name: 'health',
    description: 'Служебная проверка работоспособности.',
  },
  {
    name: 'auth',
    description:
      'Вход, регистрация, OAuth, обновление и отзыв сессии, верификация email.',
  },
  {
    name: 'users',
    description:
      'Профиль текущего пользователя (аккаунт): имя, аватар, локаль, напоминания.',
  },
  {
    name: 'notifications',
    description:
      'Push: регистрация и отзыв FCM-токена для текущего пользователя.',
  },
  {
    name: 'address',
    description:
      'Подсказки адреса и канонизация (геокодеры на стороне сервера).',
  },
  {
    name: 'catalog',
    description: 'Иерархия рубрик / категорий услуг для форм и витрины.',
  },
  {
    name: 'directory',
    description:
      'Витрина: общие подсказки для фильтра каталога (без списков сущностей).',
  },
  {
    name: 'directory-organizations',
    description:
      'Витрина: публичные списки и карточки организаций (салонов), отзывы в каталоге.',
  },
  {
    name: 'directory-specialists',
    description:
      'Витрина: публичные списки и карточки специалистов, отзывы в каталоге.',
  },
  {
    name: 'cabinet-organizations',
    description:
      'Кабинет владельца/админа организации: создание салона, рассмотрение заявок мастеров в коллектив.',
  },
  {
    name: 'cabinet-specialists',
    description:
      'Кабинет мастера: онбординг, профиль, личные услуги, смена активной организации.',
  },
  {
    name: 'bookings',
    description:
      'Записи: со стороны клиента (создание, список, отмена, отзывы) и действия мастера (`/bookings/me/...`).',
  },
  {
    name: 'favorites',
    description: 'Избранное пользователя (салоны и мастера).',
  },
  {
    name: 'personalization',
    description:
      'Портрет пользователя и рекомендации (частично с опциональным JWT).',
  },
  {
    name: 'advertising',
    description: 'Рекламные вставки по размещению.',
  },
  {
    name: 'files',
    description: 'Загрузка и выдача файлов (публичные и приватные).',
  },
  {
    name: 'dev',
    description:
      'Только вне production: отладочные сценарии. В т.ч. `POST …/dev/moderation/ollama-eval` — пробная модерация текста через Ollama; `POST …/dev/moderation/image-eval` — загрузка картинки и ответ NSFW-сервиса (NudeNet + CLIP); смена статуса брони; пересчёт персонализации; FCM; очередь `ContentModerationCase`. При `DISABLE_DEV_TEST_ROUTES=true` ручки отдают **404** (и не попадают в prod).',
  },
] as const;

function applyOrderedSwaggerTags(
  document: ReturnType<typeof SwaggerModule.createDocument>,
): void {
  const declared = new Map(
    SWAGGER_TAG_ORDER_AND_DESCRIPTIONS.map((t) => [t.name, t.description]),
  );
  const existing = document.tags ?? [];
  const extras = existing.filter((t) => !declared.has(t.name));
  document.tags = [
    ...SWAGGER_TAG_ORDER_AND_DESCRIPTIONS.map((t) => ({
      name: t.name,
      description: t.description,
    })),
    ...extras.map((t) => ({
      name: t.name,
      description: t.description ?? '',
    })),
  ];
}

export function createOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Services App API')
    .setDescription(
      'Backend REST API. Авторизация email/password, OAuth (Google) и JWT; дальнейшие домены — по мере появления модулей.',
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

  applyOrderedSwaggerTags(document);

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
