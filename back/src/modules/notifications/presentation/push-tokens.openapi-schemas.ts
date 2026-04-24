export const registerPushTokenRequestSchema = {
  type: 'object' as const,
  required: ['token'],
  additionalProperties: false,
  properties: {
    token: {
      type: 'string' as const,
      description: 'FCM registration token (web)',
    },
    userAgent: { type: 'string' as const, nullable: true },
  },
};

export const revokePushTokenRequestSchema = {
  type: 'object' as const,
  required: ['token'],
  additionalProperties: false,
  properties: {
    token: { type: 'string' as const },
  },
};

export const pushTokenOkResponseSchema = {
  type: 'object' as const,
  required: ['ok'],
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean' as const, example: true },
  },
};
