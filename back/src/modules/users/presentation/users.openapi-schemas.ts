export const userProfileSchema = {
  type: 'object',
  required: [
    'id',
    'email',
    'name',
    'avatarUrl',
    'locale',
    'bookingReminderEnabled',
    'bookingReminderLeadMinutes',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    name: { type: 'string' },
    avatarUrl: {
      type: 'string',
      nullable: true,
      description: 'Путь `/v1/files/public/...` или абсолютный URL',
    },
    locale: {
      type: 'string',
      nullable: true,
      enum: ['en', 'vi', 'ru'],
      description:
        'Локаль интерфейса из клиента; для писем о бронированиях и т.п.',
    },
    bookingReminderEnabled: { type: 'boolean' },
    bookingReminderLeadMinutes: {
      type: 'integer',
      enum: [15, 30, 60],
      description:
        'За сколько минут до визита прислать push (только при включённом флаге).',
    },
  },
};

export const patchMeRequestSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 120 },
    avatarUrl: {
      description:
        'Путь `/v1/files/public/...` или абсолютный http(s) URL; **null** — убрать аватар',
      oneOf: [
        { type: 'string', minLength: 1, maxLength: 2048 },
        { type: 'null' },
      ],
    },
    locale: {
      type: 'string',
      enum: ['en', 'vi', 'ru'],
      description: 'Как в префиксе пути клиента `/[locale]/...`',
    },
    bookingReminderEnabled: { type: 'boolean' },
    bookingReminderLeadMinutes: { type: 'integer', enum: [15, 30, 60] },
  },
};

export const patchSpecialistActiveOrganizationRequestSchema = {
  type: 'object',
  required: ['organizationId'],
  properties: {
    organizationId: { type: 'string', format: 'uuid' },
  },
};

export const patchSpecialistActiveOrganizationResponseSchema = {
  type: 'object',
  required: ['activeOrganizationId', 'cancelledBookingsCount'],
  properties: {
    activeOrganizationId: { type: 'string', format: 'uuid' },
    cancelledBookingsCount: {
      type: 'integer',
      minimum: 0,
      description:
        'Сколько активных записей отменено на прежней организации (canceled_by_master).',
    },
  },
};

export const specialistOnboardingResponseSchema = {
  type: 'object',
  required: ['onboardingStep', 'specialist'],
  properties: {
    onboardingStep: {
      type: 'integer',
      enum: [1, 3, 4, 5, 6],
      description:
        '1 — профиль; 3 — услуги; 4 — организация; 5 — финальный экран; 6 — готово.',
    },
    specialist: {
      type: 'object',
      nullable: true,
      description: 'Профиль специалиста; null если ещё не создан.',
      additionalProperties: true,
    },
  },
};

export const patchSpecialistOnboardingProfileRequestSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 120 },
    phone: { oneOf: [{ type: 'string', minLength: 1, maxLength: 32 }, { type: 'null' }] },
    bio: { type: 'string', minLength: 1, maxLength: 4000 },
    experienceYears: { type: 'integer', minimum: 0, maximum: 80 },
    imageUrl: { oneOf: [{ type: 'string', minLength: 1 }, { type: 'null' }] },
    imageAlt: { oneOf: [{ type: 'string', minLength: 1 }, { type: 'null' }] },
    massage: {
      type: 'object',
      description: 'Параметры вертикали «массаж»; поля с другой крупной категории — отдельные объекты.',
      properties: {
        pressureLevel: { type: 'integer', minimum: 1, maximum: 5 },
        pressureAdaptsToClient: { type: 'boolean' },
      },
    },
  },
};

export const joinOnboardingOrganizationRequestSchema = {
  type: 'object',
  required: ['organizationId'],
  properties: {
    organizationId: { type: 'string', format: 'uuid' },
  },
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

export const createOnboardingOrganizationRequestSchema = {
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
    phone: { type: 'string', maxLength: 32, nullable: true },
    email: { type: 'string', maxLength: 254, nullable: true },
    website: { type: 'string', maxLength: 2048, nullable: true },
    yearsInBusiness: { type: 'integer', minimum: 0, maximum: 80, nullable: true },
    imageUrl: { type: 'string', minLength: 1, maxLength: 2048, nullable: true },
    imageAlt: { type: 'string', maxLength: 500, nullable: true },
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

export const createSpecialistPersonalServiceRequestSchema = {
  type: 'object',
  required: ['categoryId', 'priceOptions'],
  properties: {
    categoryId: { type: 'string', format: 'uuid' },
    description: { type: 'string', maxLength: 4000 },
    priceOptions: {
      type: 'array',
      minItems: 1,
      maxItems: 20,
      items: {
        type: 'object',
        required: ['durationMinutes', 'priceAmount'],
        properties: {
          durationMinutes: { type: 'integer', minimum: 15, maximum: 1440 },
          priceAmount: { type: 'integer', minimum: 1 },
          currency: { type: 'string', minLength: 3, maxLength: 3 },
        },
      },
    },
  },
};

export const createSpecialistPersonalServiceResponseSchema = {
  type: 'object',
  required: ['serviceId'],
  properties: {
    serviceId: { type: 'string', format: 'uuid' },
  },
};
