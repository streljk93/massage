/** Голые JSON Schema для Swagger (без @ApiProperty — обходят ложные circular dependency в swagger plugin). */

export const authUserSchema = {
  type: 'object',
  required: ['id', 'email', 'name'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    name: { type: 'string', example: 'Jane Doe' },
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
      enum: ['INVALID_CREDENTIALS', 'INVALID_REFRESH_TOKEN', 'USER_NOT_FOUND'],
    },
    message: { type: 'string' },
  },
};
