import { DEFAULT_OLLAMA_MODERATION_MODEL } from './moderation-defaults.const';
import { DEFAULT_ADDRESS_PROVIDER_ORDER } from '../modules/address/domain/address-providers.const';

const nodeEnv = process.env.NODE_ENV ?? 'development';

function positiveInt(raw: string | undefined, fallback: number): number {
  const v = Number(raw);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

/** Порог NSFW (картинки): 0..1, по умолчанию 0.5 (выше → ручная проверка). NudeNet даёт ~0..1 по «телесным» классам; при необходимости MODERATION_IMAGE_UNSAFE_THRESHOLD=0.65. */
function moderationUnsafeThreshold(
  raw: string | undefined,
  fallback: number,
): number {
  const v = Number(raw);
  if (!Number.isFinite(v)) {
    return fallback;
  }
  return Math.min(0.99, Math.max(0.01, v));
}

export default () => ({
  nodeEnv,
  jwt: {
    secret:
      process.env.JWT_SECRET ??
      (nodeEnv === 'production'
        ? ''
        : 'dev-only-jwt-secret-do-not-use-in-production'),
    accessExpiresSec: Number(process.env.JWT_ACCESS_EXPIRES_SEC ?? 900),
    refreshExpiresSec: Number(process.env.JWT_REFRESH_EXPIRES_SEC ?? 604800),
  },
  /**
   * OAuth (клиентский вход): `POST /v1/auth/login/oauth` — Google `idToken`.
   * Несколько client id через запятую: `GOOGLE_OAUTH_CLIENT_ID=web,ios,android`.
   */
  oauth: {
    google: {
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ?? '',
    },
  },
  /**
   * Лимит HTTP-запросов на IP (скользящее окно), защита от простого DoS.
   * Хранилище in-memory; при нескольких инстансах — вынести в Redis (см. @nestjs/throttler).
   */
  httpThrottle: {
    ttlMs: positiveInt(process.env.HTTP_THROTTLE_TTL_MS, 60_000),
    limit: positiveInt(process.env.HTTP_THROTTLE_LIMIT, 400),
  },
  /** MinIO / S3-совместимое хранилище файлов */
  storage: {
    endpoint:
      process.env.S3_ENDPOINT ??
      (nodeEnv === 'production' ? '' : 'http://127.0.0.1:9000'),
    region: process.env.S3_REGION ?? 'us-east-1',
    accessKey: process.env.S3_ACCESS_KEY ?? 'minioadmin',
    secretKey: process.env.S3_SECRET_KEY ?? 'minioadmin',
    bucket: process.env.S3_BUCKET ?? 'services-uploads',
  },
  /**
   * Защита от злоупотреблений (массовый захват слотов): лимиты на клиента.
   * Переопределение через env без правки кода.
   */
  bookingCreationLimits: {
    /** Одновременно в ожидании подтверждения (pending). */
    maxPendingPerClient: positiveInt(process.env.BOOKING_CLIENT_MAX_PENDING, 5),
    /** Созданий записи за скользящий час. */
    maxCreatesPerHour: positiveInt(
      process.env.BOOKING_CLIENT_MAX_CREATES_PER_HOUR,
      10,
    ),
    /** Созданий записи за скользящие 24 часа. */
    maxCreatesPerDay: positiveInt(
      process.env.BOOKING_CLIENT_MAX_CREATES_PER_DAY,
      30,
    ),
  },
  /**
   * Превью слотов на карточках каталога / главной / поиска.
   * Меньше `calendarDays` — быстрее ответ (меньше кандидатов слотов на мастера).
   * Переопределение: `LISTING_CARD_PREVIEW_CALENDAR_DAYS` (сжатие 1–90 в DirectoryService).
   */
  listingCardPreview: {
    calendarDays: positiveInt(
      process.env.LISTING_CARD_PREVIEW_CALENDAR_DAYS,
      1,
    ),
  },
  /**
   * Страница профиля салона / мастера: сколько календарных дней слотов отдавать в API.
   * Отдельно от {@link listingCardPreview}, чтобы узкое превью на карточках не сужало профиль.
   */
  profileSlotPreview: {
    calendarDays: positiveInt(
      process.env.PROFILE_SLOT_PREVIEW_CALENDAR_DAYS,
      14,
    ),
  },
  /**
   * Dev-only HTTP-ручки (напр. `POST /v1/dev/bookings/set-status`, `POST /v1/dev/personalization/recompute-profile`).
   * В `production` всегда выключено. В dev/staging: по умолчанию включено;
   * отключить все такие ручки: `DISABLE_DEV_TEST_ROUTES=true`.
   */
  devTestRoutes: {
    enabled:
      nodeEnv !== 'production' &&
      process.env.DISABLE_DEV_TEST_ROUTES !== 'true',
  },
  /**
   * Firebase Admin (FCM). JSON сервисного аккаунта: целиком в `FIREBASE_SERVICE_ACCOUNT_JSON`
   * или путь `GOOGLE_APPLICATION_CREDENTIALS` (стандартный путь gcloud).
   * Без учётных данных уведомления на сервере не отправляются; регистрация токенов в БД всё равно работает.
   */
  firebase: {
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() ?? '',
  },
  /**
   * Персонализация витрины: хранение сырых `UserBehaviorEvent` (портрет пересчитывается отдельно).
   * События старше N дней удаляются cron'ом (`PersonalizationCronService`).
   */
  personalization: {
    behaviorEventsRetentionDays: Math.max(
      1,
      positiveInt(
        process.env.PERSONALIZATION_BEHAVIOR_EVENTS_RETENTION_DAYS,
        90,
      ),
    ),
  },
  /**
   * Почта: в `production` — только Resend; в dev — только SMTP (MailHog: `127.0.0.1:1025` или `mailhog:1025` в compose).
   * `POST /auth/register` в production без `RESEND_API_KEY` — 503. В dev без `SMTP_HOST` — код в лог (warn).
   */
  mail: {
    from: process.env.MAIL_FROM?.trim() || 'Services <noreply@localhost>',
    resendApiKey: process.env.RESEND_API_KEY?.trim() ?? '',
    /**
     * Публичный URL фронта (как `CLIENT_ORIGIN`): картинки в письмах и кнопка «Мои записи».
     * В dev при пустом env — `http://localhost:3000`, чтобы в MailHog подтягивался `/massage.png` из Next `public/`.
     */
    clientAppOrigin:
      process.env.CLIENT_APP_ORIGIN?.trim() ||
      process.env.CLIENT_ORIGIN?.trim() ||
      (nodeEnv !== 'production' ? 'http://localhost:3000' : ''),
    /** Путь к статике на фронте (файл в `client/public/`). */
    reminderHeroImagePath:
      process.env.MAIL_REMINDER_HERO_PATH?.trim() || '/massage.png',
    smtp: {
      host: process.env.SMTP_HOST?.trim() ?? '',
      port: positiveInt(process.env.SMTP_PORT, 587),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER?.trim() ?? '',
      pass: process.env.SMTP_PASS?.trim() ?? '',
    },
  },
  /**
   * Адреса / геокодинг (см. `modules/address`).
   * Порядок цепочки: `ADDRESS_PROVIDER_ORDER` в env (если задан); иначе {@link DEFAULT_ADDRESS_PROVIDER_ORDER} — один дефолт в коде, без дублирования строки здесь.
   */
  address: {
    providerOrder: (() => {
      const raw =
        process.env.ADDRESS_PROVIDER_ORDER?.trim() ??
        DEFAULT_ADDRESS_PROVIDER_ORDER.join(',');
      return raw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    })(),
    /** Таймаут HTTP к одному провайдеру (мс); после — fallback на следующий. */
    requestTimeoutMs: positiveInt(process.env.ADDRESS_GEOCODE_TIMEOUT_MS, 3500),
    locationiq: {
      apiKey: process.env.LOCATIONIQ_API_KEY?.trim() ?? '',
    },
    opencage: {
      apiKey: process.env.OPENCAGE_API_KEY?.trim() ?? '',
    },
    geoapify: {
      apiKey: process.env.GEOAPIFY_API_KEY?.trim() ?? '',
    },
    nominatim: {
      baseUrl: (
        process.env.ADDRESS_NOMINATIM_BASE_URL?.trim() ||
        'https://nominatim.openstreetmap.org'
      ).replace(/\/$/, ''),
      userAgent: (() => {
        const u = process.env.ADDRESS_NOMINATIM_USER_AGENT?.trim();
        if (u) {
          return u;
        }
        return 'ServicesApp/1.0 (address module; Nominatim; configure ADDRESS_NOMINATIM_USER_AGENT in production)';
      })(),
    },
  },
  /** Redis: очереди BullMQ (фоновая модерация при `MODERATION_QUEUE_ENABLED` не `false`). */
  redis: {
    host: process.env.REDIS_HOST?.trim() ?? '127.0.0.1',
    port: positiveInt(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD?.trim() ?? '',
  },
  /**
   * Предмодерация контента (Ollama в Docker / отдельный хост). Без доступного API новый UGC уходит в очередь на ручную проверку.
   */
  moderation: {
    /** `false` у `MODERATION_QUEUE_ENABLED` — без BullMQ: синхронно в HTTP, без Redis. */
    useContentQueue: process.env.MODERATION_QUEUE_ENABLED !== 'false',
    ollamaBaseUrl: (process.env.OLLAMA_BASE_URL ?? '').trim(),
    ollamaModel: (
      process.env.OLLAMA_MODEL ?? DEFAULT_OLLAMA_MODERATION_MODEL
    ).trim(),
    /** HTTP-таймаут к Ollama /api/chat. Несколько текстовых полей + локальный CPU часто дают >25 с. */
    requestTimeoutMs: positiveInt(process.env.OLLAMA_REQUEST_TIMEOUT_MS, 90_000),
    /**
     * Автомодерация **только изображений** витрины: контейнер `image-moderation` (POST …/v1/score).
     * Тексты по-прежнему через Ollama — картинки туда не передаются.
     * `IMAGE_MODERATION_BASE_URL` не задан (undefined) → в non-production localhost:8085; пустая строка явно отключает; в production без URL — галерея в ручную очередь.
     */
    imageModeration: {
      /** Пустая строка в .env явно отключает. Не задано — в non-production см. ниже (локальный :8085). */
      baseUrl: (() => {
        const raw = process.env.IMAGE_MODERATION_BASE_URL;
        if (raw !== undefined) {
          return raw.trim();
        }
        if (process.env.NODE_ENV === 'production') {
          return '';
        }
        /* Локально: `docker compose up image-moderation` пробрасывает 8085 на хост; совпадает с `scripts/init-project.mjs`. */
        return 'http://127.0.0.1:8085';
      })(),
      /** Origin Nest для GET `/v1/files/...`; контейнер `image-moderation` должен достучаться до хоста (не 127.0.0.1 внутри контейнера). В compose задаётся `http://back:3001`; локально см. `.env.example`. */
      fileFetchOrigin: (
        process.env.MODERATION_FILE_FETCH_ORIGIN?.trim() ||
        `http://host.docker.internal:${process.env.PORT ?? '3001'}`
      ).replace(/\/$/, ''),
      unsafeThreshold: moderationUnsafeThreshold(
        process.env.MODERATION_IMAGE_UNSAFE_THRESHOLD,
        0.5,
      ),
      requestTimeoutMs: positiveInt(
        process.env.MODERATION_IMAGE_REQUEST_TIMEOUT_MS,
        60_000,
      ),
    },
  },
});
