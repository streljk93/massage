/** JSON Schema для Swagger — [Dev] test FCM. */

export const devTestFcmRequestSchema = {
  type: 'object',
  required: ['email', 'title', 'text'],
  properties: {
    email: { type: 'string', format: 'email' },
    title: { type: 'string', maxLength: 200 },
    text: { type: 'string', maxLength: 2000, description: 'Текст уведомления' },
    delaySeconds: {
      type: 'integer',
      minimum: 0,
      maximum: 120,
      description:
        'Секунд ждать до FCM; запрос завершится сразу после отправки. Для теста фона/другой вкладки',
    },
  },
};

export const devTestFcmResponseSchema = {
  type: 'object',
  required: ['ok', 'userId', 'email', 'tokensCount', 'delaySecondsApplied', 'fcm'],
  properties: {
    ok: { type: 'boolean' },
    userId: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    tokensCount: { type: 'integer', minimum: 0 },
    delaySecondsApplied: { type: 'integer', minimum: 0, maximum: 120 },
    fcm: {
      type: 'object',
      required: ['attempted', 'successCount', 'errors'],
      properties: {
        attempted: { type: 'integer' },
        successCount: { type: 'integer' },
        errors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
  },
};
