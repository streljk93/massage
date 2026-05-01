/**
 * Коды причины отмены записи салоном/мастером после подтверждения (`Booking.cancelReason`).
 * Синхронизировать с клиентом: `client/src/entities/booking/model/booking-master-cancel-display-codes.ts`,
 * `client/src/views/business/subpages/model/master-cancel-reasons.ts` (бизнес‑ЛК).
 */
export const BOOKING_MASTER_CANCEL_REASON_CODES = [
  'master_schedule_conflict',
  'master_unavailable_or_ill',
  'master_organization_closed',
  'master_duplicate_or_error',
  'master_other',
] as const;

export type BookingMasterCancelReasonCode =
  (typeof BOOKING_MASTER_CANCEL_REASON_CODES)[number];
