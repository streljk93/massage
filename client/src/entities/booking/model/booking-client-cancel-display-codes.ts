/**
 * Коды отмены клиентом — как `BOOKING_CLIENT_CANCEL_REASON_CODES` на бэкенде.
 */
export const BOOKING_CLIENT_CANCEL_DISPLAY_CODES = [
  "client_schedule_changed",
  "client_found_alternative",
  "client_health_personal",
  "client_price_or_service",
  "client_other",
] as const;

export type BookingClientCancelDisplayCode =
  (typeof BOOKING_CLIENT_CANCEL_DISPLAY_CODES)[number];

export function isBookingClientCancelDisplayCode(
  raw: string | null | undefined,
): raw is BookingClientCancelDisplayCode {
  return (
    typeof raw === "string" &&
    (BOOKING_CLIENT_CANCEL_DISPLAY_CODES as readonly string[]).includes(
      raw.trim(),
    )
  );
}
