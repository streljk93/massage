/** OpenAPI-схемы для кабинета офферов организации (`OrganizationOffering` Phase A). */

export const organizationOfferingCabinetPriceOptionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'durationMinutes', 'priceAmount', 'currency', 'status'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    durationMinutes: { type: 'integer' },
    priceAmount: { type: 'integer' },
    currency: { type: 'string' },
    status: { type: 'string' },
  },
};

export const organizationOfferingCabinetPriceOverrideSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'offeringPriceOptionId', 'customPrice'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    offeringPriceOptionId: { type: 'string', format: 'uuid' },
    customPrice: { type: 'integer' },
  },
};

export const organizationOfferingCabinetSpecialistAssignmentSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'specialistId', 'status', 'displayName', 'priceOverrides'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    specialistId: { type: 'string', format: 'uuid' },
    status: { type: 'string' },
    displayName: { type: 'string', nullable: true },
    priceOverrides: {
      type: 'array',
      items: organizationOfferingCabinetPriceOverrideSchema,
    },
  },
};

export const organizationOfferingsCabinetItemSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'slug',
    'title',
    'description',
    'publicationStatus',
    'categoryId',
    'priceOptions',
    'specialistAssignments',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    slug: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string', nullable: true },
    publicationStatus: { type: 'string' },
    firstPublishedAt: { type: 'string', format: 'date-time', nullable: true },
    lastPublishedAt: { type: 'string', format: 'date-time', nullable: true },
    categoryId: { type: 'string', format: 'uuid' },
    priceOptions: {
      type: 'array',
      items: organizationOfferingCabinetPriceOptionSchema,
    },
    specialistAssignments: {
      type: 'array',
      items: organizationOfferingCabinetSpecialistAssignmentSchema,
    },
  },
};

export const organizationOfferingsListResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['offerings'],
  properties: {
    offerings: {
      type: 'array',
      items: organizationOfferingsCabinetItemSchema,
    },
  },
};

export const createOrganizationOfferingDraftRequestSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'slug', 'categoryId'],
  properties: {
    title: { type: 'string', minLength: 1 },
    slug: {
      type: 'string',
      pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
    },
    categoryId: { type: 'string', format: 'uuid' },
    description: { type: 'string', nullable: true },
  },
};

export const createOrganizationOfferingDraftResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'slug', 'title', 'publicationStatus'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    slug: { type: 'string' },
    title: { type: 'string' },
    publicationStatus: { type: 'string' },
  },
};

export const assignableSpecialistItemSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['specialistId', 'displayName'],
  properties: {
    specialistId: { type: 'string', format: 'uuid' },
    displayName: { type: 'string', nullable: true },
  },
};

export const assignableSpecialistsListResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['specialists'],
  properties: {
    specialists: {
      type: 'array',
      items: assignableSpecialistItemSchema,
    },
  },
};

export const patchOrganizationOfferingRequestSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string', minLength: 1 },
    description: { type: 'string', nullable: true },
    slug: {
      type: 'string',
      pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
    },
    categoryId: { type: 'string', format: 'uuid' },
  },
};

export const organizationOfferingPatchResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'slug', 'title', 'description', 'categoryId', 'publicationStatus', 'firstPublishedAt'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    slug: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string', nullable: true },
    categoryId: { type: 'string', format: 'uuid' },
    publicationStatus: { type: 'string' },
    firstPublishedAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

export const publishOrganizationOfferingResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'publicationStatus', 'firstPublishedAt', 'lastPublishedAt'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    publicationStatus: { type: 'string' },
    firstPublishedAt: { type: 'string', format: 'date-time', nullable: true },
    lastPublishedAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

export const createOfferingPriceOptionRequestSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['durationMinutes', 'priceAmount'],
  properties: {
    durationMinutes: { type: 'integer', minimum: 1 },
    priceAmount: { type: 'integer', minimum: 0 },
    currency: { type: 'string', minLength: 1 },
  },
};

export const createOfferingPriceOptionResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'durationMinutes', 'priceAmount', 'currency', 'status'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    durationMinutes: { type: 'integer' },
    priceAmount: { type: 'integer' },
    currency: { type: 'string' },
    status: { type: 'string' },
  },
};

export const patchOfferingPriceOptionRequestSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string' },
    remove: { type: 'boolean' },
    priceAmount: { type: 'integer', minimum: 0 },
  },
};

export const patchOfferingPriceOptionResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'durationMinutes', 'priceAmount', 'currency', 'status', 'deletedAt'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    durationMinutes: { type: 'integer' },
    priceAmount: { type: 'integer' },
    currency: { type: 'string' },
    status: { type: 'string' },
    deletedAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

export const createSpecialistOfferingAssignmentRequestSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['specialistId'],
  properties: {
    specialistId: { type: 'string', format: 'uuid' },
  },
};

export const createSpecialistOfferingAssignmentResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'specialistId', 'status'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    specialistId: { type: 'string', format: 'uuid' },
    status: { type: 'string' },
  },
};

export const patchSpecialistOfferingAssignmentRequestSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: {
    status: { type: 'string' },
  },
};

export const patchSpecialistOfferingAssignmentResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'specialistId', 'status'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    specialistId: { type: 'string', format: 'uuid' },
    status: { type: 'string' },
  },
};

export const createSpecialistOfferingPriceOverrideRequestSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['offeringPriceOptionId', 'customPrice'],
  properties: {
    offeringPriceOptionId: { type: 'string', format: 'uuid' },
    customPrice: { type: 'integer', minimum: 1 },
  },
};

export const createSpecialistOfferingPriceOverrideResponseSchema =
  organizationOfferingCabinetPriceOverrideSchema;

export const patchSpecialistOfferingPriceOverrideRequestSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['customPrice'],
  properties: {
    customPrice: { type: 'integer', minimum: 1 },
  },
};

export const patchSpecialistOfferingPriceOverrideResponseSchema =
  organizationOfferingCabinetPriceOverrideSchema;
