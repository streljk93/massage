/** JSON Schema для Swagger — бронирования клиента. */

export const createBookingRequestSchema = {
  type: 'object',
  required: ['specialistId', 'serviceId', 'durationMinutes', 'startsAt'],
  properties: {
    specialistId: { type: 'string', format: 'uuid' },
    serviceId: { type: 'string', format: 'uuid' },
    durationMinutes: { type: 'integer', minimum: 1 },
    startsAt: { type: 'string', description: 'ISO 8601' },
  },
};

export const createBookingResponseSchema = {
  type: 'object',
  required: ['id', 'status', 'startsAt', 'endsAt'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    status: { type: 'string', enum: ['pending'] },
    startsAt: { type: 'string', format: 'date-time' },
    endsAt: { type: 'string', format: 'date-time' },
    pendingExpiresAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

export const bookingListItemSchema = {
  type: 'object',
  required: [
    'id',
    'status',
    'statusLabel',
    'specialistId',
    'specialistName',
    'serviceName',
    'amount',
    'currency',
    'startsAt',
    'endsAt',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    status: { type: 'string' },
    statusLabel: {
      type: 'string',
      description:
        'Человекочитаемый статус на выбранной локали (см. `BookingStatusLocale`).',
    },
    specialistId: { type: 'string', format: 'uuid' },
    specialistName: { type: 'string' },
    specialistImageUrl: { type: 'string', nullable: true, format: 'uri' },
    serviceName: { type: 'string' },
    amount: { type: 'integer', nullable: true },
    currency: { type: 'string' },
    startsAt: { type: 'string', format: 'date-time' },
    endsAt: { type: 'string', format: 'date-time' },
    pendingExpiresAt: { type: 'string', format: 'date-time', nullable: true },
    cancelReason: {
      type: 'string',
      nullable: true,
      description:
        'Код причины, канонический англоязычный авто-текст из БД или пояснение; см. доменные константы бронирований.',
    },
    cancellationComment: {
      type: 'string',
      nullable: true,
      description:
        'Дополнительный комментарий при отмене (часто от мастера); системные отмены могут оставлять поле пустым.',
    },
  },
};

export const bookingsListResponseSchema = {
  type: 'object',
  required: ['bookings'],
  properties: {
    bookings: {
      type: 'array',
      items: bookingListItemSchema,
    },
  },
};

export const cancelBookingResponseSchema = {
  type: 'object',
  required: ['id', 'status'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    status: { type: 'string', enum: ['canceled_by_client'] },
  },
};
