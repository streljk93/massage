export const calendarResourcesResponseSchema = {
  type: 'object',
  required: ['organizationId', 'resources'],
  properties: {
    organizationId: { type: 'string', format: 'uuid' },
    resources: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'type', 'specialistId', 'name', 'capacity', 'isActive'],
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
    'version',
    'resources',
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
