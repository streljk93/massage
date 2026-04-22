/** Причина отмены / истечения: не подтвердили в срок (cron). */
export const BOOKING_CANCEL_REASON_PENDING_CONFIRMATION_TIMEOUT =
  'pending_confirmation_timeout' as const;

export type BookingCancelReasonCode =
  typeof BOOKING_CANCEL_REASON_PENDING_CONFIRMATION_TIMEOUT;
