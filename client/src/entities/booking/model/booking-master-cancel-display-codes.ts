/**
 * Коды отмены салоном после подтверждения — как `BOOKING_MASTER_CANCEL_REASON_CODES` на бэкенде
 * (`booking-master-cancel-reasons.ts`). Для отображения в истории / ЛК.
 */
export const BOOKING_MASTER_CANCEL_DISPLAY_CODES = [
  "master_schedule_conflict",
  "master_unavailable_or_ill",
  "master_organization_closed",
  "master_duplicate_or_error",
  "master_other",
] as const;

export type BookingMasterCancelDisplayCode =
  (typeof BOOKING_MASTER_CANCEL_DISPLAY_CODES)[number];

export function isBookingMasterCancelDisplayCode(
  raw: string | null | undefined,
): raw is BookingMasterCancelDisplayCode {
  return (
    typeof raw === "string" &&
    (BOOKING_MASTER_CANCEL_DISPLAY_CODES as readonly string[]).includes(
      raw.trim(),
    )
  );
}
