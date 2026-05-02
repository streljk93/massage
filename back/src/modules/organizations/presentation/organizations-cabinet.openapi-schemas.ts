export const organizationCabinetEditProfileResponseSchema = {
  type: 'object',
  required: [
    'name',
    'description',
    'phone',
    'email',
    'website',
    'yearsInBusiness',
    'addressLine',
    'city',
    'latitude',
    'longitude',
    'placeReference',
    'serviceCategoryIds',
    'galleryItems',
  ],
  properties: {
    name: { type: 'string' },
    description: { type: 'string', nullable: true },
    phone: { type: 'string', nullable: true },
    email: { type: 'string', nullable: true },
    website: { type: 'string', nullable: true },
    yearsInBusiness: {
      type: 'integer',
      minimum: 0,
      maximum: 80,
      nullable: true,
    },
    addressLine: { type: 'string', nullable: true },
    city: { type: 'string', nullable: true },
    latitude: { type: 'number', nullable: true },
    longitude: { type: 'number', nullable: true },
    placeReference: {
      type: 'object',
      nullable: true,
      required: ['provider', 'placeId'],
      properties: {
        provider: {
          type: 'string',
          enum: ['locationiq', 'geoapify', 'opencage', 'nominatim'],
        },
        placeId: { type: 'string' },
      },
    },
    serviceCategoryIds: {
      type: 'array',
      items: { type: 'string', format: 'uuid' },
    },
    galleryItems: {
      type: 'array',
      items: {
        type: 'object',
        required: ['url', 'alt'],
        properties: {
          url: { type: 'string' },
          alt: { type: 'string', nullable: true },
        },
      },
    },
  },
};

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
      description:
        'Ссылка на объект геокодера. Если одновременно переданы непустой `addressLine`, `latitude` и `longitude` — координаты и строка адреса берутся с клиента (точка с карты кабинета); иначе сервер заполняет адрес через resolve по place_id.',
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
    yearsInBusiness: {
      type: 'integer',
      minimum: 0,
      maximum: 80,
      nullable: true,
    },
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
    'Адрес: `placeReference` + опционально `addressLine`/`latitude`/`longitude` с карты кабинета; или только `placeReference` (resolve на сервере); или без placeReference — `addressLine`+`latitude`+`longitude`.',
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

export const workplaceJoinApplicantCabinetProfileResponseSchema = {
  type: 'object',
  required: ['specialist'],
  properties: {
    specialist: {
      type: 'object',
      description:
        'Тот же объект, что `specialist` в GET /specialists/me/onboarding (кабинет мастера).',
      additionalProperties: true,
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
            enum: ['pending', 'accepted', 'rejected', 'withdrawn', 'blocked'],
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

export const organizationCabinetDeleteBookingsPreviewResponseSchema = {
  type: 'object',
  required: ['bookings'],
  properties: {
    bookings: {
      type: 'array',
      description:
        'Активные записи салона во всех мастерах — если продолжить удаление организации, они будут автоматически отменены.',
      items: {
        type: 'object',
        required: [
          'id',
          'status',
          'statusLabel',
          'startsAt',
          'endsAt',
          'pendingExpiresAt',
          'clientDisplayName',
          'categoryShortName',
          'durationMinutes',
          'specialistDisplayName',
        ],
        properties: {
          id: { type: 'string', format: 'uuid' },
          status: {
            type: 'string',
            enum: ['pending', 'confirmed', 'in_progress'],
          },
          statusLabel: { type: 'string' },
          startsAt: { type: 'string', format: 'date-time' },
          endsAt: { type: 'string', format: 'date-time' },
          pendingExpiresAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
          clientDisplayName: { type: 'string' },
          categoryShortName: { type: 'string' },
          durationMinutes: {
            type: 'integer',
            minimum: 1,
            description:
              'Длительность слота на момент записи; отдельно от endsAt − startsAt.',
          },
          specialistDisplayName: {
            type: 'string',
            description:
              'Имя/витринное имя мастера, принимающего по записи.',
          },
        },
      },
    },
  },
};

export const organizationCabinetDeleteOrganizationResponseSchema = {
  type: 'object',
  required: ['ok', 'cancelledBookingsCount'],
  properties: {
    ok: { type: 'boolean', enum: [true] },
    cancelledBookingsCount: {
      type: 'integer',
      minimum: 0,
      description: 'Число отменённых активных записей.',
    },
  },
};
