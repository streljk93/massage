import { BOOKING_STATUS_ALL_ORDERED } from '../../bookings/domain/booking-status-all-ordered';
import { organizationScopedPermissionsSchema } from '../../organizations/presentation/organizations-cabinet.openapi-schemas';

export const specialistOnboardingResponseSchema = {
  type: 'object',
  required: ['onboardingStep', 'specialist'],
  properties: {
    onboardingStep: {
      type: 'integer',
      enum: [1, 2, 3, 4, 5, 6, 11, 12, 13],
      description:
        '1 — строки Specialist нет; 2 — выбор режима работы (solo/business/employed_salon); 3 — сферы (большие категории онбординга); 4 — профиль мастера; 5 — поля вертикали массажа (если выбрана); 11 — место работы (создание org или заявка); 12 — навыки (подкатегории каталога без цены); 13 — финальный экран перед complete; 6 — онбординг завершён.',
    },
    specialist: {
      type: 'object',
      nullable: true,
      description: 'Профиль специалиста; null если ещё не создан.',
      additionalProperties: true,
    },
  },
};

/** Черновик онбординга: режим работы и большие категории (до места работы с организацией). */
export const patchSpecialistOnboardingPreferencesRequestSchema = {
  type: 'object',
  minProperties: 1,
  properties: {
    workPattern: {
      type: 'string',
      enum: ['solo', 'business', 'employed_salon'],
      description:
        'solo — на себя; business — свой салон; employed_salon — заявка в существующий салон без создания своей организации.',
    },
    majorCategorySlugs: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'string',
        pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
      },
      description:
        'Слаги больших категорий каталога; после привязки к организации список не меняется через эту ручку.',
    },
    serviceCategoryIds: {
      type: 'array',
      maxItems: 80,
      items: { type: 'string', format: 'uuid' },
      description:
        'Подкатегории каталога как навыки мастера (`SpecialistSkill`); должны принадлежать объединению сфер онбординга и сфер активной организации.',
    },
  },
};

export const patchSpecialistActiveOrganizationRequestSchema = {
  type: 'object',
  required: ['organizationId'],
  properties: {
    organizationId: {
      oneOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }],
      description:
        'UUID организации как место приёма или null — снять место приёма (новые записи к мастеру через салон не принимаются, пока снова не выбрано место приёма).',
    },
  },
};

export const patchSpecialistActiveOrganizationResponseSchema = {
  type: 'object',
  required: ['activeOrganizationId', 'cancelledBookingsCount'],
  properties: {
    activeOrganizationId: {
      oneOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }],
      description: 'Текущее место приёма после операции; null если снято.',
    },
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
          'membershipStatus',
          'workplaceJoinRequestId',
          'role',
          'permissions',
          'isActiveWorkplace',
          'publicationModerationStatus',
          'salonCabinetPreview',
          'publishedCoverImageUrl',
        ],
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          membershipStatus: {
            type: 'string',
            enum: ['employed', 'pending_join'],
            description:
              'employed — мастер в штате; pending_join — подана заявка на вступление, членства ещё нет.',
          },
          workplaceJoinRequestId: {
            description:
              'Идентификатор `SpecialistWorkplaceJoinRequest` для строки с pending_join; для employed — null.',
            oneOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }],
          },
          role: {
            description:
              'Роль в организации для employed; для pending_join — null до принятия заявки.',
            oneOf: [
              {
                type: 'string',
                enum: ['owner', 'admin', 'specialist'],
              },
              { type: 'null' },
            ],
          },
          permissions: organizationScopedPermissionsSchema,
          isActiveWorkplace: {
            type: 'boolean',
            description:
              'Совпадает с `activeOrganizationId` мастера — только для employed; для pending_join всегда false.',
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
        'Текущая активная организация мастера; null — место приёма не выбрано (новые записи к мастеру через салон не принимаются, пока снова не выбрано место приёма).',
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
    gender: {
      type: 'string',
      enum: ['male', 'female'],
      description: 'Пол специалиста для клиентского фильтра в поиске.',
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

export const patchSpecialistSkillsRequestSchema = {
  type: 'object',
  required: ['serviceCategoryIds'],
  properties: {
    serviceCategoryIds: {
      type: 'array',
      maxItems: 80,
      items: { type: 'string', format: 'uuid' },
      description:
        'Полная замена навыков мастера (`SpecialistSkill`); те же правила majors, что при онбординге.',
    },
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
    'visitReviewComplete',
    'visitReviewOrganizationRating',
    'visitReviewSpecialistRating',
    'visitReviewDisplayRating',
    'visitReviewOrganizationExcerpt',
    'visitReviewSpecialistExcerpt',
    'visitReviewExcerpt',
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
    organizationId: {
      type: 'string',
      format: 'uuid',
      nullable: true,
      description:
        'Организация в контексте этой брони; может быть null, если запись без привязки к салону (не смешивать с `scope` строки услуги в каталоге).',
    },
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
    visitReviewComplete: {
      type: 'boolean',
      description:
        'Оба отзыва по визиту (салон + мастер) созданы клиентом после статуса `done`.',
    },
    visitReviewOrganizationRating: {
      type: 'number',
      nullable: true,
      description: 'Оценка салона (1–5), если отзыв уже есть.',
    },
    visitReviewSpecialistRating: {
      type: 'number',
      nullable: true,
      description: 'Оценка мастера (1–5), если отзыв уже есть.',
    },
    visitReviewDisplayRating: {
      type: 'number',
      nullable: true,
      description:
        'Среднее двух оценок для краткого превью; заполнено при `visitReviewComplete === true`.',
    },
    visitReviewOrganizationExcerpt: {
      type: 'string',
      nullable: true,
      description:
        'Комментарий отзыва о салоне (черновик модерации важнее опубликованного).',
    },
    visitReviewSpecialistExcerpt: {
      type: 'string',
      nullable: true,
      description:
        'Комментарий отзыва о мастере (черновик модерации важнее опубликованного).',
    },
    visitReviewExcerpt: {
      type: 'string',
      nullable: true,
      description:
        'Краткое объединённое превью для совместимости: комментарий о мастере или о салоне.',
    },
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

export const specialistCabinetClientItemSchema = {
  type: 'object',
  required: [
    'clientUserId',
    'clientDisplayName',
    'clientAvatarUrl',
    'totalBookingsCount',
    'doneBookingsCount',
    'upcomingBookingsCount',
    'lastBookingAt',
    'lastVisitAt',
    'nextBookingAt',
    'averageVisitRating',
  ],
  properties: {
    clientUserId: {
      type: 'string',
      format: 'uuid',
      description:
        'Стабильный идентификатор пользователя-клиента внутри кабинета.',
    },
    clientDisplayName: { type: 'string' },
    clientAvatarUrl: { type: 'string', nullable: true },
    totalBookingsCount: { type: 'integer', minimum: 0 },
    doneBookingsCount: { type: 'integer', minimum: 0 },
    upcomingBookingsCount: { type: 'integer', minimum: 0 },
    lastBookingAt: { type: 'string', format: 'date-time', nullable: true },
    lastVisitAt: { type: 'string', format: 'date-time', nullable: true },
    nextBookingAt: { type: 'string', format: 'date-time', nullable: true },
    averageVisitRating: {
      type: 'number',
      nullable: true,
      description:
        'Средняя оценка из отзывов клиента по завершённым визитам, если отзывы есть.',
    },
  },
};

export const specialistCabinetClientsListResponseSchema = {
  type: 'object',
  required: ['activeOrganizationId', 'clients', 'nextCursor'],
  properties: {
    activeOrganizationId: {
      oneOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }],
      description:
        'Текущее место приёма мастера, по которому строится список клиентов.',
    },
    clients: {
      type: 'array',
      items: specialistCabinetClientItemSchema,
    },
    nextCursor: {
      type: 'string',
      nullable: true,
      description: 'Передайте как `cursor` для следующей страницы.',
    },
  },
};
