import {
  organizationListItemSchema,
  specialistListItemSchema,
} from '../../directory/presentation/directory.openapi-schemas';

export const ingestPersonalizationEventsRequestSchema = {
  type: 'object',
  required: ['events'],
  properties: {
    sessionId: { type: 'string', minLength: 8, maxLength: 128 },
    events: {
      type: 'array',
      minItems: 1,
      maxItems: 50,
      items: {
        type: 'object',
        required: ['eventType'],
        properties: {
          eventType: { type: 'string', minLength: 1, maxLength: 64 },
          entityType: {
            type: 'string',
            minLength: 1,
            maxLength: 32,
            nullable: true,
          },
          entityId: { type: 'string', format: 'uuid', nullable: true },
          metadata: { type: 'object', additionalProperties: true },
        },
      },
    },
  },
};

export const ingestPersonalizationEventsResponseSchema = {
  type: 'object',
  required: ['accepted'],
  properties: {
    accepted: { type: 'integer' },
  },
};

export const personalizationRecommendationsResponseSchema = {
  type: 'object',
  required: [
    'source',
    'personalizationReady',
    'majorSlug',
    'categorySlugsUsed',
    'specialists',
    'organizations',
  ],
  properties: {
    source: {
      type: 'string',
      enum: ['profile', 'guest_popular'],
    },
    personalizationReady: {
      type: 'boolean',
      description:
        'true — достаточно сигнала (портрет: подкатегории или запрос с фильтрами) для персонального блока; false — гость или пустой портрет (клиент скрывает блок).',
    },
    majorSlug: { type: 'string', nullable: true, example: 'massage' },
    categorySlugsUsed: {
      type: 'array',
      items: { type: 'string' },
    },
    specialists: {
      type: 'array',
      items: specialistListItemSchema,
    },
    organizations: {
      type: 'array',
      items: organizationListItemSchema,
    },
  },
};
