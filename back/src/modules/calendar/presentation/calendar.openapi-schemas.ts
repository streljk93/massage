export const calendarResourcesResponseSchema = {
  type: 'object',
  required: ['organizationId', 'resources'],
  properties: {
    organizationId: { type: 'string', format: 'uuid' },
    resources: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'id',
          'type',
          'specialistId',
          'name',
          'capacity',
          'isActive',
        ],
        properties: {
          id: { type: 'string', format: 'uuid' },
          type: { type: 'string', enum: ['specialist', 'room', 'equipment'] },
          specialistId: { type: 'string', format: 'uuid', nullable: true },
          name: { type: 'string' },
          capacity: { type: 'integer' },
          isActive: { type: 'boolean' },
        },
      },
    },
  },
};

const calendarEventSchema = {
  type: 'object',
  required: [
    'id',
    'organizationId',
    'bookingId',
    'startsAt',
    'endsAt',
    'type',
    'status',
    'blockReason',
    'notes',
    'createdByDisplayName',
    'version',
    'resources',
    'permissions',
    'booking',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    organizationId: { type: 'string', format: 'uuid' },
    bookingId: { type: 'string', format: 'uuid', nullable: true },
    startsAt: { type: 'string', format: 'date-time' },
    endsAt: { type: 'string', format: 'date-time' },
    type: { type: 'string', enum: ['booking', 'block'] },
    status: {
      type: 'string',
      enum: ['pending', 'confirmed', 'in_progress', 'cancelled'],
    },
    blockReason: {
      type: 'string',
      enum: ['break', 'vacation', 'manual'],
      nullable: true,
    },
    notes: { type: 'string', nullable: true },
    createdByDisplayName: { type: 'string', nullable: true },
    version: { type: 'integer' },
    resources: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'type', 'name', 'specialistId', 'role'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          type: { type: 'string', enum: ['specialist', 'room', 'equipment'] },
          name: { type: 'string' },
          specialistId: { type: 'string', format: 'uuid', nullable: true },
          role: { type: 'string', nullable: true },
        },
      },
    },
    permissions: {
      type: 'object',
      additionalProperties: false,
      required: ['manage'],
      properties: {
        manage: { type: 'boolean' },
      },
    },
    booking: {
      type: 'object',
      nullable: true,
      required: [
        'id',
        'status',
        'clientDisplayName',
        'specialistName',
        'categoryShortName',
        'amount',
        'currency',
      ],
      properties: {
        id: { type: 'string', format: 'uuid' },
        status: { type: 'string' },
        clientDisplayName: { type: 'string' },
        specialistName: { type: 'string', nullable: true },
        categoryShortName: { type: 'string' },
        amount: { type: 'integer', nullable: true },
        currency: { type: 'string' },
      },
    },
  },
};

export const calendarEventsResponseSchema = {
  type: 'object',
  required: ['organizationId', 'events', 'nextCursor'],
  properties: {
    organizationId: { type: 'string', format: 'uuid' },
    events: {
      type: 'array',
      items: calendarEventSchema,
    },
    nextCursor: { type: 'string', nullable: true },
  },
};

export const createCalendarBlockRequestSchema = {
  type: 'object',
  required: ['startsAt', 'endsAt', 'resourceIds', 'blockReason'],
  properties: {
    startsAt: { type: 'string', format: 'date-time' },
    endsAt: { type: 'string', format: 'date-time' },
    resourceIds: {
      type: 'array',
      minItems: 1,
      items: { type: 'string', format: 'uuid' },
    },
    blockReason: { type: 'string', enum: ['break', 'vacation', 'manual'] },
    notes: { type: 'string', maxLength: 1000 },
  },
};

export const createCalendarBlockResponseSchema = {
  type: 'object',
  required: ['event'],
  properties: {
    event: calendarEventSchema,
  },
};

export const updateCalendarBlockRequestSchema = {
  type: 'object',
  required: ['startsAt', 'endsAt', 'resourceIds', 'version'],
  properties: {
    startsAt: { type: 'string', format: 'date-time' },
    endsAt: { type: 'string', format: 'date-time' },
    resourceIds: {
      type: 'array',
      minItems: 1,
      items: { type: 'string', format: 'uuid' },
    },
    blockReason: { type: 'string', enum: ['break', 'vacation', 'manual'] },
    notes: { type: 'string', nullable: true, maxLength: 1000 },
    version: { type: 'integer', minimum: 1 },
  },
};

const availabilityRuleSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'weekday', 'startMinute', 'endMinute', 'type'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    weekday: { type: 'integer', minimum: 0, maximum: 6 },
    startMinute: { type: 'integer', minimum: 0, maximum: 1440 },
    endMinute: { type: 'integer', minimum: 1, maximum: 1440 },
    type: { type: 'string', enum: ['working', 'break'] },
  },
};

const availabilityOverrideSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'date', 'startsAt', 'endsAt', 'type'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    date: { type: 'string' },
    startsAt: { type: 'string', format: 'date-time', nullable: true },
    endsAt: { type: 'string', format: 'date-time', nullable: true },
    type: { type: 'string', enum: ['off', 'extra'] },
  },
};

export const availabilityRuleRequestSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['weekday', 'startMinute', 'endMinute', 'type'],
  properties: {
    weekday: { type: 'integer', minimum: 0, maximum: 6 },
    startMinute: { type: 'integer', minimum: 0, maximum: 1440 },
    endMinute: { type: 'integer', minimum: 1, maximum: 1440 },
    type: { type: 'string', enum: ['working', 'break'] },
  },
};

export const putAvailabilityRulesRequestSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['rules'],
  properties: {
    rules: {
      type: 'array',
      maxItems: 28,
      items: availabilityRuleRequestSchema,
    },
  },
};

export const putAvailabilityRulesBulkRequestSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['resourceIds', 'rules'],
  properties: {
    resourceIds: {
      type: 'array',
      minItems: 1,
      maxItems: 100,
      items: { type: 'string', format: 'uuid' },
    },
    rules: {
      type: 'array',
      maxItems: 28,
      items: availabilityRuleRequestSchema,
    },
  },
};

export const putAvailabilityRulesBulkResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['organizationId', 'resourceIds', 'updatedCount'],
  properties: {
    organizationId: { type: 'string', format: 'uuid' },
    resourceIds: {
      type: 'array',
      items: { type: 'string', format: 'uuid' },
    },
    updatedCount: { type: 'integer' },
  },
};

export const availabilityOverrideRequestSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['date', 'type'],
  properties: {
    date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    startsAt: { type: 'string', format: 'date-time', nullable: true },
    endsAt: { type: 'string', format: 'date-time', nullable: true },
    type: { type: 'string', enum: ['off', 'extra'] },
  },
};

export const calendarAvailabilityResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['resource', 'rules', 'overrides'],
  properties: {
    resource: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'organizationId', 'specialistId', 'name'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        organizationId: { type: 'string', format: 'uuid' },
        specialistId: { type: 'string', format: 'uuid', nullable: true },
        name: { type: 'string' },
      },
    },
    rules: { type: 'array', items: availabilityRuleSchema },
    overrides: { type: 'array', items: availabilityOverrideSchema },
  },
};
