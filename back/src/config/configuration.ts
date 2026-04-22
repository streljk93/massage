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
});
