/**
 * Политика мутаций строки `Booking` (проецируемые поля + version):
 *
 * - Норма: только {@link BookingAppendService} (append → commitProjectedBookingRow).
 * - Аварийное выравнивание: {@link BookingReconcileService.softRebuildBookingProjectionFromJournal} (тот же commit).
 *
 * Прямые `prisma.booking.update` вне этих путей запрещены правилом домена (guard на code review / поиск по репо).
 */

export const BOOKING_ROW_PROJECTED_FIELDS_WRITE_SOURCES = [
  'BookingAppendService',
  'BookingReconcileService',
] as const;
