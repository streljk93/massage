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
});
