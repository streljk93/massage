import { BOOKING_STATUS_ALL_ORDERED } from '../../bookings/domain/booking-status-all-ordered';

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
        required: [
          'id',
          'name',
          'role',
          'isActiveWorkplace',
          'publicationModerationStatus',
          'salonCabinetPreview',
          'publishedCoverImageUrl',
        ],
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
          salonCabinetPreview: {
            type: 'object',
            nullable: true,
            description:
              'Есть ревизия в `pending_review` — превью для кабинета; поле `name` строки организации всё ещё опубликованное (гость).',
            required: ['revisionId', 'name', 'coverImageUrl'],
            properties: {
              revisionId: { type: 'string', format: 'uuid' },
              name: {
                type: 'string',
                description:
                  'Название из черновика ревизии (может отличаться от `name`).',
              },
              coverImageUrl: {
                type: 'string',
                nullable: true,
                description:
                  'Первое фото галереи черновика; относительные URL как у остальных файлов API.',
              },
            },
          },
          publishedCoverImageUrl: {
            type: 'string',
            nullable: true,
            description:
              'Первое фото галереи опубликованного профиля организации; для карточки в кабинете, когда нет pending-ревизии.',
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
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 120,
      description:
        'Имя мастера на витрине (каталог, клиентские экраны). Не обновляет `User.name`.',
    },
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

export const specialistActiveOrganizationBookingsPreviewResponseSchema = {
  type: 'object',
  required: ['bookings'],
  properties: {
    bookings: {
      type: 'array',
      description:
        'Активные брони клиентов к текущему мастеру в указанной организации (то, что отменится при смене места приёма).',
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
              'Длительность слота на момент записи; отдельно от `endsAt - startsAt`.',
          },
        },
      },
    },
  },
};

const salonCabinetBookingStatuses = [...BOOKING_STATUS_ALL_ORDERED];

/** Список броней в кабинете мастера: «все записи» (организации, где owner/admin) или «текущее место приёма». */
export const specialistSalonCabinetBookingItemSchema = {
  type: 'object',
  required: [
    'id',
    'status',
    'statusLabel',
    'specialistId',
    'specialistName',
    'specialistImageUrl',
    'organizationId',
    'organizationName',
    'clientDisplayName',
    'categoryShortName',
    'amount',
    'currency',
    'startsAt',
    'endsAt',
    'pendingExpiresAt',
    'cancelReason',
    'cancellationComment',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    status: {
      type: 'string',
      enum: salonCabinetBookingStatuses,
    },
    statusLabel: { type: 'string' },
    specialistId: { type: 'string', format: 'uuid' },
    specialistName: {
      type: 'string',
      description: 'Мастер, принимающий по этой брони.',
    },
    specialistImageUrl: { type: 'string', nullable: true },
    organizationId: { type: 'string', format: 'uuid', nullable: true },
    organizationName: { type: 'string', nullable: true },
    clientDisplayName: {
      type: 'string',
      description: 'Имя гостя из учётной записи на момент ответа.',
    },
    categoryShortName: { type: 'string' },
    amount: { type: 'integer', nullable: true },
    currency: { type: 'string' },
    startsAt: { type: 'string', format: 'date-time' },
    endsAt: { type: 'string', format: 'date-time' },
    pendingExpiresAt: { type: 'string', format: 'date-time', nullable: true },
    cancelReason: { type: 'string', nullable: true },
    cancellationComment: { type: 'string', nullable: true },
  },
};

export const specialistSalonBookingsListResponseSchema = {
  type: 'object',
  required: ['bookings'],
  properties: {
    bookings: {
      type: 'array',
      items: specialistSalonCabinetBookingItemSchema,
    },
  },
};
