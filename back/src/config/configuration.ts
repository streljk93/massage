const nodeEnv = process.env.NODE_ENV ?? 'development';

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
});
