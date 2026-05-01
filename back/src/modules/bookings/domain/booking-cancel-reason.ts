/** Причина отмены / истечения: не подтвердили в срок (cron). */
export const BOOKING_CANCEL_REASON_PENDING_CONFIRMATION_TIMEOUT =
  'pending_confirmation_timeout' as const;

/**
 * Запись в `BookingStatusHistory.reason` при автозавершении приёма по наступлению `endsAt` (cron).
 * Не пишется в `Booking.cancelReason` (завершение не отмена).
 */
export const BOOKING_STATUS_HISTORY_REASON_AUTO_DONE_AT_SLOT_END =
  'auto_done_at_slot_end' as const;

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

/**
 * Автоотмена активных записей при удалении организации владельцем из кабинета.
 */
export const BOOKING_CANCEL_REASON_ORGANIZATION_DELETED_EN =
  'The salon was removed. This booking was cancelled automatically.' as const;

export type BookingCancelReasonCode =
  | typeof BOOKING_CANCEL_REASON_PENDING_CONFIRMATION_TIMEOUT
  | typeof BOOKING_CANCEL_REASON_MASTER_LEFT_WORKPLACE_ADDRESS;
