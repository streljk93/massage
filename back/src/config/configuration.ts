const nodeEnv = process.env.NODE_ENV ?? 'development';

function positiveInt(raw: string | undefined, fallback: number): number {
  const v = Number(raw);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
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
});
