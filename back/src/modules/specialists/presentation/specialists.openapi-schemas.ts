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

export const specialistMyWorkplaceJoinRequestsResponseSchema = {
  type: 'object',
  required: ['requests'],
  properties: {
    requests: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'id',
          'organizationId',
          'status',
          'createdAt',
          'updatedAt',
          'resolvedAt',
          'organization',
        ],
        properties: {
          id: { type: 'string', format: 'uuid' },
          organizationId: { type: 'string', format: 'uuid' },
          status: {
            type: 'string',
            enum: ['pending', 'accepted', 'rejected', 'withdrawn', 'blocked'],
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          resolvedAt: { type: 'string', format: 'date-time', nullable: true },
          organization: {
            type: 'object',
            required: ['id', 'name'],
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
            },
          },
        },
      },
    },
  },
};

export const specialistMyOrganizationsResponseSchema = {
  type: 'object',
  required: ['organizations', 'activeOrganizationId'],
  properties: {
    organizations: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'role', 'isActiveWorkplace', 'publicationModerationStatus'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          role: {
            type: 'string',
            enum: ['owner', 'admin', 'specialist'],
            description: 'Роль мастера в этой организации.',
          },
          isActiveWorkplace: {
            type: 'boolean',
            description:
              'Совпадает с `activeOrganizationId` мастера — новые брони и адрес витрины.',
          },
          publicationModerationStatus: {
            type: 'string',
            enum: ['approved', 'pending_review', 'rejected'],
            description:
              'Витрина: approved — в каталоге; pending_review / rejected — на модерации или отклонён публикация салона.',
          },
        },
      },
    },
    activeOrganizationId: {
      oneOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }],
      description:
        'Текущая активная организация мастера; null — только личный приём / не выбрано.',
    },
  },
};

export const patchSpecialistProfileRequestSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 120 },
    phone: {
      oneOf: [
        { type: 'string', minLength: 1, maxLength: 32 },
        { type: 'null' },
      ],
    },
    bio: { type: 'string', minLength: 1, maxLength: 4000 },
    experienceYears: { type: 'integer', minimum: 0, maximum: 80 },
    imageUrl: { oneOf: [{ type: 'string', minLength: 1 }, { type: 'null' }] },
    imageAlt: { oneOf: [{ type: 'string', minLength: 1 }, { type: 'null' }] },
    massage: {
      type: 'object',
      description:
        'Параметры вертикали «массаж»; поля с другой крупной категории — отдельные объекты.',
      properties: {
        pressureLevel: { type: 'integer', minimum: 1, maximum: 5 },
        pressureAdaptsToClient: { type: 'boolean' },
      },
    },
  },
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

export const deleteSpecialistPersonalServiceResponseSchema = {
  type: 'object',
  required: ['ok'],
  properties: {
    ok: { type: 'boolean', enum: [true] },
  },
};
