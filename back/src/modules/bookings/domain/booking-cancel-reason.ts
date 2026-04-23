/** Причина отмены / истечения: не подтвердили в срок (cron). */
export const BOOKING_CANCEL_REASON_PENDING_CONFIRMATION_TIMEOUT =
  'pending_confirmation_timeout' as const;

/**
 * Канонический англоязычный текст для `Booking.cancelReason` при автотмене активных записей
 * после смены мастером текущей организации (хранение в БД по умолчанию на английском).
 */
export const BOOKING_AUTO_CANCEL_MASTER_LEFT_WORKPLACE_EN =
  'The specialist is no longer available at this workplace. The booking was cancelled automatically.' as const;

/**
 * Устаревшее машинное значение (до записи английского текста в БД); оставлено для совместимости.
 */
export const BOOKING_CANCEL_REASON_MASTER_LEFT_WORKPLACE_ADDRESS =
  'master_left_workplace_address' as const;

export type BookingCancelReasonCode =
  | typeof BOOKING_CANCEL_REASON_PENDING_CONFIRMATION_TIMEOUT
  | typeof BOOKING_CANCEL_REASON_MASTER_LEFT_WORKPLACE_ADDRESS;
