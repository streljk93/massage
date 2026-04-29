/** JSON Schema для Swagger — [Dev] POST …/dev/moderation/ollama-eval */

export const devModerationOllamaEvalRequestSchema = {
  type: 'object',
  required: ['text'],
  properties: {
    text: {
      type: 'string',
      description:
        'Строка для проверки (как есть, без нормализации на бэкенде перед отправкой в Ollama)',
      maxLength: 64000,
    },
    label: {
      type: 'string',
      description:
        'Метка в промпте (по умолчанию «preview»), чтобы различать поля если несколько',
      maxLength: 64,
    },
  },
};

export const devModerationOllamaEvalResponseSchema = {
  type: 'object',
  properties: {
    verdict: {
      type: 'string',
      enum: ['pass', 'review'],
      description: 'Итог модерации (после парсинга JSON ответа модели)',
    },
    rawSummary: {
      type: 'string',
      nullable: true,
      description:
        '`reason` от модели + фрагмент сырого ответа или сообщение при ошибке',
    },
    infraUnavailable: {
      type: 'boolean',
      description:
        'true — проблемы с конфигурацией/сетью/моделью Ollama, не вердикт по контенту',
    },
  },
};
