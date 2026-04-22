import {
  BOOKING_API_CODE_TO_MESSAGE_KEY,
  type BookingCreateMessageKey,
} from "@/shared/lib/api/booking-api-error-i18n";
import { extractApiErrorCode } from "@/shared/lib/api/extract-api-error-code";

export type { BookingCreateMessageKey };

/**
 * Сопоставление тела ошибки API (Nest `{ code, message }`) с ключом `apiErrorToast`.
 */
export function mapBookingCreateApiErrorToMessageKey(
  error: unknown,
): BookingCreateMessageKey {
  const code = extractApiErrorCode(error);
  if (!code) {
    return "bookingGeneric";
  }
  const key =
    BOOKING_API_CODE_TO_MESSAGE_KEY[
      code as keyof typeof BOOKING_API_CODE_TO_MESSAGE_KEY
    ];
  return key ?? "bookingGeneric";
}

/**
 * Исключение при `fetch` / не-HTTP ошибка — тот же текст, что и `networkTitle`.
 */
export function mapBookingCreateThrownErrorToMessageKey(
  error: unknown,
): BookingCreateMessageKey {
  const code = extractApiErrorCode(error);
  if (code) {
    const key =
      BOOKING_API_CODE_TO_MESSAGE_KEY[
        code as keyof typeof BOOKING_API_CODE_TO_MESSAGE_KEY
      ];
    if (key) {
      return key;
    }
  }
  return "networkTitle";
}

export type BookingCreateClientResult<TData> =
  | { ok: true; data: TData }
  | { ok: false; messageKey: BookingCreateMessageKey };

/**
 * Единая обработка ответа `bookingsCreate` (Hey API: `data` / `error`).
 */
export function interpretBookingCreateResponse<TData>(res: {
  data?: TData;
  error?: unknown;
}): BookingCreateClientResult<TData> {
  if (res.error) {
    return {
      ok: false,
      messageKey: mapBookingCreateApiErrorToMessageKey(res.error),
    };
  }
  if (res.data === undefined || res.data === null) {
    return { ok: false, messageKey: "bookingGeneric" };
  }
  return { ok: true, data: res.data };
}
