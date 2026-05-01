/**
 * Коды причины отмены клиентом (`Booking.cancelReason`).
 * Синхронизировать с клиентом: `client/src/views/bookings/model/client-cancel-reasons.ts`,
 * `client/src/entities/booking/model/booking-client-cancel-display-codes.ts` (отображение в истории / ЛК).
 */
export const BOOKING_CLIENT_CANCEL_REASON_CODES = [
  'client_schedule_changed',
  'client_found_alternative',
  'client_health_personal',
  'client_price_or_service',
  'client_other',
] as const;

export type BookingClientCancelReasonCode =
  (typeof BOOKING_CLIENT_CANCEL_REASON_CODES)[number];
