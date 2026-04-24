/** JSON Schema для Swagger — бронирования клиента. */

import { BOOKING_CLIENT_CANCEL_REASON_CODES } from '../domain/booking-client-cancel-reasons';
import { BOOKING_STATUS_ALL_ORDERED } from '../domain/booking-status-all-ordered';

const bookingStatusEnum = [...BOOKING_STATUS_ALL_ORDERED];

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
    status: {
      type: 'string',
      enum: ['pending', 'confirmed'],
      description:
        '`confirmed` — если у мастера включено авто‑подтверждение; иначе `pending` с `pendingExpiresAt`.',
    },
    startsAt: { type: 'string', format: 'date-time' },
    endsAt: { type: 'string', format: 'date-time' },
    pendingExpiresAt: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description:
        'Дедлайн подтверждения для `pending`; для `confirmed` — `null`.',
    },
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
    status: {
      type: 'string',
      enum: bookingStatusEnum,
      description: 'Код статуса (`BookingStatus` в БД).',
    },
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

const clientCancelReasonEnum = [...BOOKING_CLIENT_CANCEL_REASON_CODES];

export const cancelBookingRequestSchema = {
  type: 'object',
  properties: {
    cancelReason: {
      type: 'string',
      enum: clientCancelReasonEnum,
      description:
        'Для `pending` не передаётся. Для `confirmed` / `in_progress` — обязателен (пишется в `Booking.cancelReason`). При `client_other` нужен непустой `cancellationComment`.',
    },
    cancellationComment: {
      type: 'string',
      maxLength: 2000,
      description:
        'Для `pending` не передаётся. Иначе опционально, кроме случая `cancelReason` = `client_other`.',
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
    status: {
      type: 'string',
      enum: ['canceled_by_client', 'reject_by_client'],
      description:
        '`reject_by_client` — отмена из `pending`; `canceled_by_client` — из `confirmed` / `in_progress`.',
    },
  },
};

/** Ответ `POST /specialist/bookings/:id/confirm` — после ручного подтверждения мастером. */
export const specialistConfirmBookingResponseSchema =
  createBookingResponseSchema;
