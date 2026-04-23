/** JSON Schema для Swagger (справочник: специалисты и организации). */

const directoryCategoryTagSchema = {
  type: 'object',
  required: ['slug', 'shortName'],
  properties: {
    slug: { type: 'string', example: 'neck' },
    shortName: { type: 'string', example: 'Neck' },
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
    },
  },
};

const specialistBookableServiceSchema = {
  type: 'object',
  required: [
    'id',
    'name',
    'categoryShortName',
    'durationMinutes',
    'priceVndByDuration',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string', example: 'Relaxing massage' },
    categoryShortName: {
      type: 'string',
      example: 'Body massage',
      description:
        'Локализованный shortName подкатегории каталога (`Service.category`).',
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
    'latitude',
    'longitude',
    'metaLine',
    'servicesLine',
    'categories',
    'slotGroups',
    'bookableServices',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    userId: { type: 'string', format: 'uuid' },
    name: { type: 'string', example: 'Иван' },
    bio: { type: 'string', nullable: true },
    experienceYears: { type: 'integer', nullable: true },
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
    imageUrl: { type: 'string', nullable: true, format: 'uri' },
    imageAlt: { type: 'string', nullable: true },
    metaLine: { type: 'string', example: '~ 1 km | ул. Нгуен Тхай Хок' },
    servicesLine: { type: 'string', example: 'Классический массаж, спорт' },
    categories: {
      type: 'array',
      items: directoryCategoryTagSchema,
    },
    slotGroups: {
      type: 'array',
      items: listingSlotGroupItemSchema,
    },
    bookableServices: {
      type: 'array',
      items: specialistBookableServiceSchema,
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
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    slug: { type: 'string', example: 'demo-salon-seed' },
    name: { type: 'string' },
    description: { type: 'string', nullable: true },
    city: { type: 'string', nullable: true },
    addressLine: { type: 'string', nullable: true },
    phone: { type: 'string', nullable: true },
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
  required: ['categories', 'priceRangeVnd'],
  properties: {
    categories: {
      type: 'array',
      items: directoryCategoryTagSchema,
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

/** Ответ GET /organizations/:id — карточка салона + мастера. */
export const organizationDetailResponseSchema = {
  type: 'object',
  required: [...organizationListItemSchema.required, 'staff'],
  properties: {
    ...organizationListItemSchema.properties,
    staff: {
      type: 'array',
      items: organizationStaffMemberSchema,
    },
  },
};
