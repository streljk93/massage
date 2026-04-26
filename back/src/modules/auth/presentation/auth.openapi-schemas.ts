/** Голые JSON Schema для Swagger (без @ApiProperty — обходят ложные circular dependency в swagger plugin). */

export const authUserSchema = {
  type: 'object',
  required: ['id', 'email', 'name', 'avatarUrl'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    name: { type: 'string', example: 'Jane Doe' },
    avatarUrl: {
      type: 'string',
      nullable: true,
      description: 'Публичный URL или путь `/v1/files/public/...`',
    },
  },
};

export const authTokensResponseSchema = {
  type: 'object',
  required: ['user', 'accessToken', 'refreshToken'],
  properties: {
    user: authUserSchema,
    accessToken: {
      type: 'string',
      description: 'JWT access token (Authorization: Bearer …)',
    },
    refreshToken: {
      type: 'string',
      description: 'JWT refresh token',
    },
  },
};

export const authRegisterPendingResponseSchema = {
  type: 'object',
  required: ['status', 'email'],
  properties: {
    status: {
      type: 'string',
      enum: ['verification_required'],
    },
    email: { type: 'string', format: 'email' },
  },
};

export const authVerifyEmailRequestSchema = {
  type: 'object',
  required: ['email', 'code'],
  properties: {
    email: { type: 'string', format: 'email' },
    code: {
      type: 'string',
      pattern: '^[0-9]{6}$',
      description: '6-digit code from email',
    },
  },
};

export const authResendVerificationRequestSchema = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', format: 'password' },
    locale: {
      type: 'string',
      enum: ['en', 'ru', 'vi'],
      description:
        'Язык письма с кодом (аккаунт ещё не подтверждён — только для этого письма).',
    },
  },
};

export const authRegisterRequestSchema = {
  type: 'object',
  required: ['email', 'name', 'password'],
  properties: {
    email: { type: 'string', format: 'email' },
    name: { type: 'string', minLength: 1, maxLength: 120, example: 'Jane' },
    password: {
      type: 'string',
      minLength: 8,
      maxLength: 256,
      format: 'password',
    },
    locale: {
      type: 'string',
      enum: ['en', 'ru', 'vi'],
      description:
        'Язык OTP-письма. До подтверждения email в профиль не сохраняется.',
    },
  },
};

export const authLoginRequestSchema = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', format: 'password' },
  },
};

export const authRefreshRequestSchema = {
  type: 'object',
  required: ['refreshToken'],
  properties: {
    refreshToken: {
      type: 'string',
      description: 'JWT refresh token from login or previous refresh',
    },
  },
};

export const authEmailConflictSchema = {
  type: 'object',
  required: ['code', 'message'],
  properties: {
    code: { type: 'string', enum: ['EMAIL_ALREADY_REGISTERED'] },
    message: { type: 'string' },
  },
};

export const authUnauthorizedSchema = {
  type: 'object',
  required: ['code', 'message'],
  properties: {
    code: {
      type: 'string',
      enum: [
        'INVALID_CREDENTIALS',
        'INVALID_REFRESH_TOKEN',
        'USER_NOT_FOUND',
        'USER_NOT_VERIFIED',
      ],
    },
    message: { type: 'string' },
  },
};

export const authForbiddenSchema = {
  type: 'object',
  required: ['code', 'message'],
  properties: {
    code: {
      type: 'string',
      enum: ['EMAIL_NOT_VERIFIED'],
    },
    message: { type: 'string' },
  },
};

export const authBadRequestVerificationSchema = {
  type: 'object',
  required: ['code', 'message'],
  properties: {
    code: {
      type: 'string',
      enum: [
        'VERIFICATION_NOT_FOUND',
        'VERIFICATION_EXPIRED',
        'INVALID_CODE',
        'ALREADY_VERIFIED',
      ],
    },
    message: { type: 'string' },
  },
};

export const authServiceUnavailableMailSchema = {
  type: 'object',
  required: ['code', 'message'],
  properties: {
    code: {
      type: 'string',
      enum: ['MAIL_NOT_CONFIGURED', 'MAIL_SEND_FAILED'],
    },
    message: { type: 'string' },
  },
};
