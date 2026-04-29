export const createOrganizationRequestSchema = {
  type: 'object',
  required: ['name', 'serviceCategoryIds'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 200 },
    placeReference: {
      type: 'object',
      required: ['provider', 'placeId'],
      properties: {
        provider: {
          type: 'string',
          enum: ['locationiq', 'geoapify', 'opencage', 'nominatim'],
        },
        placeId: { type: 'string', minLength: 1, maxLength: 400 },
      },
      description: 'Сервер разрешает place_id через `GET/POST /v1/address/...` (предпочтительно).',
    },
    addressLine: { type: 'string', minLength: 1, maxLength: 500 },
    city: { type: 'string', maxLength: 120, nullable: true },
    latitude: { type: 'number', minimum: -90, maximum: 90 },
    longitude: { type: 'number', minimum: -180, maximum: 180 },
    description: { type: 'string', maxLength: 4000 },
    phone: {
      type: 'string',
      maxLength: 32,
      nullable: true,
      description:
        'Вьетнам E.164: +84 и 8–12 цифр национального номера (как в профиле мастера). Пусто — не указывать.',
    },
    email: {
      type: 'string',
      format: 'email',
      maxLength: 254,
      nullable: true,
    },
    website: {
      type: 'string',
      maxLength: 2048,
      nullable: true,
      description: 'URL сайта; допустимо без схемы — сервер добавит https://.',
    },
    yearsInBusiness: { type: 'integer', minimum: 0, maximum: 80, nullable: true },
    imageUrl: { type: 'string', minLength: 1, maxLength: 2048, nullable: true },
    imageAlt: { type: 'string', maxLength: 500, nullable: true },
    galleryImageUrls: {
      type: 'array',
      maxItems: 24,
      items: { type: 'string', minLength: 1, maxLength: 2048 },
      description:
        'URL изображений витрины в порядке показа. Удобно передать обложку через `imageUrl` (станет первым элементом галереи), остальное — в этом массиве; либо только этот массив. Дубликаты URL отбрасываются.',
    },
    serviceCategoryIds: {
      type: 'array',
      minItems: 1,
      maxItems: 40,
      items: { type: 'string', format: 'uuid' },
    },
  },
  description:
    'Адрес: либо `placeReference` (рекомендуется), либо `addressLine`+`latitude`+`longitude` (устар. путь).',
};

export const workplaceJoinRequestReviewRequestSchema = {
  type: 'object',
  required: ['decision'],
  properties: {
    decision: {
      type: 'string',
      enum: ['accept', 'reject', 'block'],
      description:
        'accept — трудоустройство; reject — отклонить; block — отклонить и запретить новые заявки этого мастера в эту организацию.',
    },
  },
};

export const workplaceJoinRequestReviewResponseSchema = {
  type: 'object',
  required: ['ok', 'decision'],
  properties: {
    ok: { type: 'boolean', const: true },
    decision: {
      type: 'string',
      enum: ['accept', 'reject', 'block'],
    },
  },
};

export const workplaceJoinRequestListResponseSchema = {
  type: 'object',
  required: ['requests'],
  properties: {
    requests: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'id',
          'specialistId',
          'organizationId',
          'status',
          'createdAt',
          'updatedAt',
          'resolvedAt',
          'specialist',
        ],
        properties: {
          id: { type: 'string', format: 'uuid' },
          specialistId: { type: 'string', format: 'uuid' },
          organizationId: { type: 'string', format: 'uuid' },
          status: {
            type: 'string',
            enum: [
              'pending',
              'accepted',
              'rejected',
              'withdrawn',
              'blocked',
            ],
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          resolvedAt: { type: 'string', format: 'date-time', nullable: true },
          specialist: {
            type: 'object',
            required: ['id', 'userId', 'user'],
            properties: {
              id: { type: 'string', format: 'uuid' },
              userId: { type: 'string', format: 'uuid' },
              user: {
                type: 'object',
                required: ['id', 'name', 'email'],
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                },
              },
            },
          },
        },
      },
    },
  },
};

export const workplaceOrganizationSearchResponseSchema = {
  type: 'object',
  required: ['organizations'],
  properties: {
    organizations: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'addressLine', 'city'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          addressLine: { type: 'string', nullable: true },
          city: { type: 'string', nullable: true },
        },
      },
    },
  },
};
