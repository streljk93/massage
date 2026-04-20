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
