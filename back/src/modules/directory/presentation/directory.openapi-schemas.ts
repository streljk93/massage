/** JSON Schema для Swagger (справочник: специалисты и организации). */

const directoryCategoryTagSchema = {
  type: 'object',
  required: ['slug', 'shortName'],
  properties: {
    slug: { type: 'string', example: 'neck' },
    shortName: { type: 'string', example: 'Neck' },
  },
};

const directoryBodyZoneTagSchema = {
  type: 'object',
  required: ['slug', 'name'],
  properties: {
    slug: { type: 'string', example: 'neck' },
    name: { type: 'string', example: 'Neck' },
  },
};

const listingSlotGroupItemSchema = {
  type: 'object',
  required: ['calendarDate', 'times'],
  properties: {
    calendarDate: {
      type: 'string',
      format: 'date',
      example: '2026-04-23',
      description:
        'Календарный день витрины (Asia/Ho_Chi_Minh), yyyy-MM-dd. Прошлые дни не отдаются.',
    },
    times: {
      type: 'array',
      items: { type: 'string', example: '09:00' },
      description:
        'У мастера — занятые слоты; у салона — пусто (см. specialistOccupiedSlotKeys).',
    },
  },
};

const listingWorkdayMinutesSchema = {
  type: 'integer',
  minimum: 0,
  description:
    'Минуты с полуночи (Asia/Ho_Chi_Minh). Начало приёма (включ.) и окончание (не включ. последний старт: end − 30 мин).',
};

const specialistOccupiedSlotKeysEntrySchema = {
  type: 'object',
  required: ['specialistId', 'keys'],
  properties: {
    specialistId: { type: 'string', format: 'uuid' },
    keys: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Ключи занятых ячеек `yyyy-MM-dd|HH:mm` (Asia/Ho_Chi_Minh) для витрины.',
    },
  },
};

const specialistBookableServiceSchema = {
  type: 'object',
  required: [
    'id',
    'categoryShortName',
    'majorSlug',
    'majorName',
    'majorSortOrder',
    'durationMinutes',
    'priceVndByDuration',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    categoryShortName: {
      type: 'string',
      example: 'Body massage',
      description:
        'Локализованный shortName подкатегории каталога (`Service.category`).',
    },
    majorSlug: {
      type: 'string',
      example: 'massage',
      description: 'Slug большой категории (`MajorServiceCategory.slug`).',
    },
    majorName: {
      type: 'string',
      example: 'Massage',
      description:
        'Локализованное название большой категории (для переключателя сфер в UI карточки).',
    },
    majorSortOrder: {
      type: 'integer',
      example: 0,
      description: 'Как у `MajorServiceCategory.sortOrder` — порядок сфер в UI.',
    },
    durationMinutes: {
      type: 'array',
      items: { type: 'integer', example: 60 },
    },
    priceVndByDuration: {
      type: 'array',
      items: { type: 'integer', example: 450000 },
    },
  },
};

export const specialistListItemSchema = {
  type: 'object',
  required: [
    'id',
    'userId',
    'name',
    'ratingAverage',
    'rating',
    'reviewsCount',
    'doneClientsCount',
    'latitude',
    'longitude',
    'metaLine',
    'servicesLine',
    'categories',
    'slotGroups',
    'bookableServices',
    'gender',
    'autoConfirmBookings',
    'listingWorkdayStartMinute',
    'listingWorkdayEndMinute',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    userId: { type: 'string', format: 'uuid' },
    name: { type: 'string', example: 'Иван' },
    bio: { type: 'string', nullable: true },
    experienceYears: { type: 'integer', nullable: true },
    doneClientsCount: {
      type: 'integer',
      minimum: 0,
      description:
        'Сколько уникальных пользователей имели визит (бронь в статусе `done`) к этому мастеру.',
    },
    ratingAverage: { type: 'number', example: 4.8 },
    rating: { type: 'number', example: 4.8 },
    reviewsCount: { type: 'integer', example: 12 },
    latitude: { type: 'number', nullable: true, example: 10.7769 },
    longitude: { type: 'number', nullable: true, example: 106.7009 },
    addressLine: {
      type: 'string',
      nullable: true,
      example: '123 Nguyen Trai, District 1',
      description:
        'Адрес текущей активной организации мастера (мастер сам выбирает место приёма).',
    },
    city: {
      type: 'string',
      nullable: true,
      example: 'Ho Chi Minh City',
      description: 'Город активной организации мастера.',
    },
    phone: {
      type: 'string',
      nullable: true,
      description:
        'Телефон для звонка клиенту: у активного салона или, если нет, у пользователя мастера.',
    },
    imageUrl: { type: 'string', nullable: true, format: 'uri' },
    imageAlt: { type: 'string', nullable: true },
    gender: {
      oneOf: [{ type: 'string', enum: ['male', 'female'] }, { type: 'null' }],
      description: 'Пол специалиста для фильтра каталога.',
    },
    metaLine: { type: 'string', example: '~ 1 km | ул. Нгуен Тхай Хок' },
    servicesLine: { type: 'string', example: 'Классический массаж, спорт' },
    categories: {
      type: 'array',
      items: directoryCategoryTagSchema,
    },
    slotGroups: {
      type: 'array',
      items: listingSlotGroupItemSchema,
      description:
        'Занятые ячейки витрины (HH:mm) по дням. Свободные строить на клиенте: сетка превью минус эти слоты.',
    },
    bookableServices: {
      type: 'array',
      items: specialistBookableServiceSchema,
    },
    autoConfirmBookings: {
      type: 'boolean',
      description:
        'Если true — бронь сразу в статусе `confirmed` (без `pending`); иначе клиент ждёт подтверждения мастера.',
    },
    listingWorkdayStartMinute: {
      ...listingWorkdayMinutesSchema,
      example: 480,
    },
    listingWorkdayEndMinute: {
      ...listingWorkdayMinutesSchema,
      example: 1320,
    },
    activeWorkplace: {
      type: 'object',
      nullable: true,
      description:
        'Текущее место приёма (`activeOrganization`). Профиль салона: GET /organizations/{id}.',
      required: ['id', 'name'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string', example: 'Phú Quốc Spa' },
      },
    },
    activeWorkplacePublicationModerationStatus: {
      type: 'string',
      enum: ['approved', 'pending_review', 'rejected'],
      description:
        'Только у самого мастера при незавершённой модерации активного салона.',
    },
  },
};

const cursorPageMetaSchema = {
  type: 'object',
  required: ['nextCursor', 'hasMore'],
  properties: {
    nextCursor: {
      type: 'string',
      nullable: true,
      description:
        'Передать как `cursor` в следующем запросе, если `hasMore: true`.',
    },
    hasMore: {
      type: 'boolean',
      description: 'Есть ли ещё элементы после текущей страницы.',
    },
  },
};

export const specialistsListResponseSchema = {
  type: 'object',
  required: ['specialists', 'cursorPage'],
  properties: {
    specialists: {
      type: 'array',
      items: specialistListItemSchema,
    },
    cursorPage: cursorPageMetaSchema,
  },
};

export const organizationListItemSchema = {
  type: 'object',
  required: [
    'id',
    'slug',
    'majorCategorySlugs',
    'name',
    'ratingAverage',
    'rating',
    'reviewsCount',
    'addressLine',
    'phone',
    'yearsInBusiness',
    'metaLine',
    'servicesLine',
    'categories',
    'slotGroups',
    'specialistOccupiedSlotKeys',
    'listingWorkdayStartMinute',
    'listingWorkdayEndMinute',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    slug: { type: 'string', example: 'demo-salon-seed' },
    majorCategorySlugs: {
      type: 'array',
      items: { type: 'string' },
      description: 'Сферы деятельности организации (большие категории каталога).',
    },
    name: { type: 'string' },
    description: { type: 'string', nullable: true },
    city: { type: 'string', nullable: true },
    addressLine: { type: 'string', nullable: true },
    phone: { type: 'string', nullable: true },
    email: { type: 'string', nullable: true },
    website: { type: 'string', nullable: true },
    yearsInBusiness: { type: 'integer', nullable: true },
    latitude: { type: 'number', nullable: true },
    longitude: { type: 'number', nullable: true },
    ratingAverage: { type: 'number', example: 4.5 },
    rating: { type: 'number', example: 4.5 },
    reviewsCount: { type: 'integer', example: 3 },
    imageUrl: { type: 'string', nullable: true, format: 'uri' },
    imageAlt: { type: 'string', nullable: true },
    metaLine: { type: 'string' },
    servicesLine: { type: 'string' },
    categories: {
      type: 'array',
      items: directoryCategoryTagSchema,
    },
    slotGroups: {
      type: 'array',
      items: listingSlotGroupItemSchema,
      description:
        'Пусто; занятость по мастерам — в specialistOccupiedSlotKeys.',
    },
    specialistOccupiedSlotKeys: {
      type: 'array',
      items: specialistOccupiedSlotKeysEntrySchema,
    },
    listingWorkdayStartMinute: {
      ...listingWorkdayMinutesSchema,
      example: 480,
    },
    listingWorkdayEndMinute: {
      ...listingWorkdayMinutesSchema,
      example: 1320,
    },
  },
};

export const organizationsListResponseSchema = {
  type: 'object',
  required: ['organizations', 'cursorPage'],
  properties: {
    organizations: {
      type: 'array',
      items: organizationListItemSchema,
    },
    cursorPage: cursorPageMetaSchema,
  },
};

const organizationStaffMemberSchema = {
  type: 'object',
  required: [
    'id',
    'userId',
    'name',
    'rating',
    'metaLine',
    'bookableServices',
    'occupiedListingSlotKeys',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    userId: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    rating: { type: 'number' },
    metaLine: { type: 'string' },
    imageUrl: { type: 'string', nullable: true, format: 'uri' },
    bookableServices: {
      type: 'array',
      items: specialistBookableServiceSchema,
    },
    occupiedListingSlotKeys: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Ключи занятых слотов витрины yyyy-MM-dd|HH:mm (пересечение с выбранным интервалом — мастер недоступен)',
    },
  },
};

export const catalogFilterOptionsResponseSchema = {
  type: 'object',
  required: ['categories', 'bodyZones', 'genders', 'priceRangeVnd'],
  properties: {
    categories: {
      type: 'array',
      items: directoryCategoryTagSchema,
    },
    bodyZones: {
      type: 'array',
      items: directoryBodyZoneTagSchema,
    },
    genders: {
      type: 'array',
      items: { type: 'string', enum: ['male', 'female'] },
    },
    priceRangeVnd: {
      type: 'object',
      nullable: true,
      required: ['min', 'max'],
      properties: {
        min: { type: 'integer', example: 100_000 },
        max: { type: 'integer', example: 2_000_000 },
      },
    },
  },
};

const directoryReviewItemSchema = {
  type: 'object',
  required: ['id', 'authorName', 'rating', 'comment', 'createdAt'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    authorName: { type: 'string', example: 'Mai L.' },
    rating: { type: 'integer', minimum: 1, maximum: 5, example: 5 },
    comment: { type: 'string', nullable: true },
    createdAt: {
      type: 'string',
      format: 'date-time',
      description: 'ISO-8601',
    },
    publicationModerationStatus: {
      type: 'string',
      enum: ['approved', 'pending_review', 'rejected'],
      description:
        'Только если отзыв ещё на модерации или отклонён — для своего текста автором (Bearer); гостям не отдаём.',
    },
  },
};

/** GET /organizations/:id/reviews и GET /specialists/:id/reviews */
export const directoryReviewsListResponseSchema = {
  type: 'object',
  required: ['items', 'cursorPage'],
  properties: {
    items: {
      type: 'array',
      items: directoryReviewItemSchema,
    },
    cursorPage: cursorPageMetaSchema,
  },
};

const organizationVitrineGalleryItemSchema = {
  type: 'object',
  required: ['url'],
  properties: {
    url: {
      type: 'string',
      format: 'uri',
      description: 'URL медиа (как сохранено в галерее).',
    },
    alt: {
      type: 'string',
      nullable: true,
      description: 'Подпись к фото (если задана в кабинете).',
    },
  },
};

/** Ответ GET /organizations/:id — карточка салона + мастера. */
export const organizationDetailResponseSchema = {
  type: 'object',
  required: [
    ...organizationListItemSchema.required,
    'staff',
    'clientsCount',
    'vitrineGalleryItems',
  ],
  properties: {
    ...organizationListItemSchema.properties,
    staff: {
      type: 'array',
      items: organizationStaffMemberSchema,
    },
    clientsCount: {
      type: 'integer',
      minimum: 0,
      description:
        'Уникальные пользователи, у которых есть хотя бы одна бронь в статусе `done` в этом салоне.',
    },
    vitrineGalleryItems: {
      type: 'array',
      items: organizationVitrineGalleryItemSchema,
      description:
        'Фото витрины салона (порядок как в кабинете). Пустой массив, если галерея не создана.',
    },
    publicationModerationStatus: {
      type: 'string',
      enum: ['approved', 'pending_review', 'rejected'],
      description:
        'Только для владельца (Bearer): пока профиль салона не одобрен, гости получают 404.',
    },
  },
};
