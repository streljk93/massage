/** JSON Schema для Swagger — бронирования клиента. */

import { BOOKING_CLIENT_CANCEL_REASON_CODES } from '../domain/booking-client-cancel-reasons';
import { BOOKING_MASTER_CANCEL_REASON_CODES } from '../domain/booking-master-cancel-reasons';
import { BOOKING_STATUS_ALL_ORDERED } from '../domain/booking-status-all-ordered';

const bookingStatusEnum = [...BOOKING_STATUS_ALL_ORDERED];

export const createBookingRequestSchema = {
  type: 'object',
  description:
    'Запись по опубликованному офферу точки: `organizationOfferingId`, `offeringPriceOptionId`; длительность и цена берутся из опции, `durationMinutes` — опционально для сверки с опцией.',
  required: [
    'specialistId',
    'startsAt',
    'organizationOfferingId',
    'offeringPriceOptionId',
  ],
  properties: {
    specialistId: { type: 'string', format: 'uuid' },
    startsAt: { type: 'string', description: 'ISO 8601' },
    durationMinutes: {
      type: 'integer',
      minimum: 1,
      description:
        'Опционально; если передано, должно совпадать с `OfferingPriceOption.durationMinutes`.',
    },
    organizationOfferingId: { type: 'string', format: 'uuid' },
    offeringPriceOptionId: { type: 'string', format: 'uuid' },
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
    'organizationName',
    'categoryShortName',
    'amount',
    'currency',
    'startsAt',
    'endsAt',
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
    organizationName: {
      type: 'string',
      nullable: true,
      description:
        'Название салона; может быть `null`, если в брони не зафиксирована организация.',
    },
    specialistImageUrl: { type: 'string', nullable: true, format: 'uri' },
    categoryShortName: { type: 'string' },
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
    visitReviewComplete: {
      type: 'boolean',
      description:
        'Оба отзыва по визиту (салон + мастер) созданы. До отправки `POST .../visit-reviews` — `false`.',
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
        'Среднее двух оценок (1–5) для превью; заполнено при `visitReviewComplete === true`.',
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
        'Краткое объединённое превью: комментарий о мастере или о салоне.',
    },
  },
};

export const submitBookingVisitReviewsRequestSchema = {
  type: 'object',
  required: ['organizationRating', 'specialistRating'],
  properties: {
    organizationRating: { type: 'integer', minimum: 1, maximum: 5 },
    specialistRating: { type: 'integer', minimum: 1, maximum: 5 },
    organizationComment: {
      type: 'string',
      maxLength: 2000,
      description: 'Опционально. Пустая строка игнорируется.',
    },
    specialistComment: {
      type: 'string',
      maxLength: 2000,
      description: 'Опционально. Пустая строка игнорируется.',
    },
  },
};

export const submitBookingVisitReviewsResponseSchema = {
  type: 'object',
  required: ['ok'],
  properties: {
    ok: { type: 'boolean', enum: [true] },
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
        'Для `pending` не передаётся. Для `confirmed` — обязателен (пишется в `Booking.cancelReason`). При `client_other` нужен непустой `cancellationComment`. Отмена из `in_progress` клиентом не поддерживается.',
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
        '`reject_by_client` — отмена из `pending`; `canceled_by_client` — из `confirmed`.',
    },
  },
};

/** Ответ `POST /bookings/me/:id/confirm` — после ручного подтверждения мастером. */
export const specialistConfirmBookingResponseSchema =
  createBookingResponseSchema;

/** Ответ `POST /bookings/me/:id/reject` — отклонение мастером/салоном до подтверждения. */
export const specialistRejectPendingBookingResponseSchema = {
  type: 'object',
  required: ['id', 'status'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    status: {
      type: 'string',
      enum: ['reject_by_master'],
      description: 'Клиент получает push об отказе салона до подтверждения записи.',
    },
  },
};


const masterCancelReasonEnum = [...BOOKING_MASTER_CANCEL_REASON_CODES];

/** Тело `POST /bookings/me/:id/cancel` — отмена подтверждённой записи мастером/салоном. */
export const specialistCancelConfirmedBookingRequestSchema = {
  type: 'object',
  required: ['cancelReason'],
  properties: {
    cancelReason: {
      type: 'string',
      enum: masterCancelReasonEnum,
      description:
        'При `master_other` в теле нужен непустой `cancellationComment`.',
    },
    cancellationComment: {
      type: 'string',
      maxLength: 2000,
      description: 'Для `master_other` — обязателен.',
    },
  },
};

/** Ответ `POST /bookings/me/:id/cancel`. */
export const specialistCancelConfirmedBookingResponseSchema = {
  type: 'object',
  required: ['id', 'status'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    status: {
      type: 'string',
      enum: ['canceled_by_master'],
      description: 'Клиент получает push об отмене с вашей стороны.',
    },
  },
};

/** Ответ `POST /bookings/me/:id/start-visit` — начало приёма. */
export const specialistStartVisitResponseSchema = {
  type: 'object',
  required: ['id', 'status', 'startsAt', 'endsAt'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    status: {
      type: 'string',
      enum: ['in_progress'],
      description: 'Приём отмечен как идущий.',
    },
    startsAt: { type: 'string', format: 'date-time' },
    endsAt: { type: 'string', format: 'date-time' },
  },
};

/** Тело `POST /bookings/me/:id/reschedule` — новый начальный слот; длительность из брони. */
export const specialistRescheduleConfirmedBookingRequestSchema = {
  type: 'object',
  required: ['startsAt'],
  properties: {
    startsAt: {
      type: 'string',
      format: 'date-time',
      description: 'Новое начало визита (ISO 8601); конец считается по `Booking.durationMinutes`.',
    },
    reasonCode: {
      type: 'string',
      maxLength: 200,
      description: 'Опционально — попадает в payload доменного события `rescheduled`.',
    },
  },
};

/** Ответ `POST /bookings/me/:id/reschedule`. */
export const specialistRescheduleConfirmedBookingResponseSchema = {
  type: 'object',
  required: ['id', 'status', 'startsAt', 'endsAt'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    status: {
      type: 'string',
      enum: ['confirmed'],
      description:
        'Статус строки после проекции остаётся подтверждённым; меняются только времена слота.',
    },
    startsAt: { type: 'string', format: 'date-time' },
    endsAt: { type: 'string', format: 'date-time' },
  },
};
