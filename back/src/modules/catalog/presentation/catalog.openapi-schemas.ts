/** JSON Schema для Swagger (каталог). */

export const catalogServiceCategoryItemSchema = {
  type: 'object',
  required: ['id', 'name', 'shortName', 'slug', 'description', 'sortOrder'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string', example: 'Массаж шеи и зоны декольте' },
    shortName: { type: 'string', example: 'шея' },
    slug: { type: 'string', example: 'neck' },
    description: { type: 'string', nullable: true },
    sortOrder: { type: 'integer', example: 0 },
  },
};

export const catalogMajorCategorySchema = {
  type: 'object',
  required: ['id', 'name', 'slug'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string', example: 'Массаж' },
    slug: { type: 'string', example: 'massage' },
  },
};

export const catalogMajorCategoryListItemSchema = {
  type: 'object',
  required: ['id', 'name', 'slug', 'sortOrder'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string', example: 'Массаж' },
    slug: { type: 'string', example: 'massage' },
    sortOrder: { type: 'integer', example: 0 },
  },
};

export const catalogMajorCategoriesListResponseSchema = {
  type: 'object',
  required: ['majorCategories'],
  properties: {
    majorCategories: {
      type: 'array',
      items: catalogMajorCategoryListItemSchema,
    },
  },
};

export const catalogCategoriesResponseSchema = {
  type: 'object',
  required: ['majorCategory', 'categories'],
  properties: {
    majorCategory: catalogMajorCategorySchema,
    categories: {
      type: 'array',
      items: catalogServiceCategoryItemSchema,
    },
  },
};

export const catalogBulkCategoriesResponseSchema = {
  type: 'object',
  required: ['sections'],
  properties: {
    sections: {
      type: 'array',
      items: catalogCategoriesResponseSchema,
    },
  },
};

export const catalogBodyZoneItemSchema = {
  type: 'object',
  required: ['id', 'slug', 'name', 'sortOrder'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    slug: { type: 'string', example: 'neck' },
    name: { type: 'string', example: 'Neck' },
    sortOrder: { type: 'integer', example: 0 },
  },
};

export const catalogBodyZonesResponseSchema = {
  type: 'object',
  required: ['majorCategory', 'bodyZones'],
  properties: {
    majorCategory: catalogMajorCategorySchema,
    bodyZones: {
      type: 'array',
      items: catalogBodyZoneItemSchema,
    },
  },
};

export const catalogMajorCategoryNotFoundSchema = {
  type: 'object',
  required: ['statusCode', 'message'],
  properties: {
    statusCode: { type: 'number', example: 404 },
    message: { type: 'string' },
    code: { type: 'string', enum: ['MAJOR_CATEGORY_NOT_FOUND'] },
  },
};

export const catalogCategoryDetailResponseSchema = {
  type: 'object',
  required: ['majorCategory', 'category'],
  properties: {
    majorCategory: catalogMajorCategorySchema,
    category: catalogServiceCategoryItemSchema,
  },
};

export const catalogServiceCategoryNotFoundSchema = {
  type: 'object',
  required: ['statusCode', 'message'],
  properties: {
    statusCode: { type: 'number', example: 404 },
    message: { type: 'string' },
    code: { type: 'string', enum: ['SERVICE_CATEGORY_NOT_FOUND'] },
  },
};
