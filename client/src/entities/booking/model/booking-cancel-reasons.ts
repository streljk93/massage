/** Синхронно с `BOOKING_CANCEL_REASON_PENDING_CONFIRMATION_TIMEOUT` на бэкенде. */
export const BOOKING_CANCEL_REASON_PENDING_CONFIRMATION_TIMEOUT =
  "pending_confirmation_timeout" as const;

/**
 * Должно дословно совпадать с `BOOKING_AUTO_CANCEL_MASTER_LEFT_WORKPLACE_EN` на бэкенде
 * (канонический английский текст в БД для этой автотмены).
 */
export const BOOKING_AUTO_CANCEL_MASTER_LEFT_WORKPLACE_EN =
  "The specialist is no longer available at this workplace. The booking was cancelled automatically." as const;

/** Устаревшее значение в БД (код до перехода на английский текст). */
export const BOOKING_CANCEL_REASON_MASTER_LEFT_WORKPLACE_ADDRESS =
  "master_left_workplace_address" as const;
