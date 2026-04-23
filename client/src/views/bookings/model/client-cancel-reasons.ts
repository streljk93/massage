/**
 * Коды причины отмены — дословно как `BOOKING_CLIENT_CANCEL_REASON_CODES` на бэкенде
 * (`back/src/modules/bookings/domain/booking-client-cancel-reasons.ts`).
 */
export const CLIENT_CANCEL_REASON_CODES = [
  "client_schedule_changed",
  "client_found_alternative",
  "client_health_personal",
  "client_price_or_service",
  "client_other",
] as const;

export type ClientCancelReasonCode = (typeof CLIENT_CANCEL_REASON_CODES)[number];
