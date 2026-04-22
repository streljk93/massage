/**
 * Соответствие кодов API создания брони и ключей `apiErrorToast` в
 * `shared/model/api-error-toast.i18n.json` (единый источник текстов).
 */
export const BOOKING_API_CODE_TO_MESSAGE_KEY = {
  BOOKING_CLIENT_PENDING_LIMIT: "bookingLimitPending",
  BOOKING_CLIENT_CREATE_RATE_HOUR: "bookingLimitHour",
  BOOKING_CLIENT_CREATE_RATE_DAY: "bookingLimitDay",
  SLOT_NOT_AVAILABLE: "bookingSlotTaken",
  INVALID_STARTS_AT: "bookingInvalidTime",
  STARTS_AT_IN_PAST: "bookingInvalidTime",
  NOT_GRID_ALIGNED: "bookingInvalidTime",
  OUTSIDE_WORKDAY: "bookingInvalidTime",
  SPECIALIST_NOT_FOUND: "bookingTargetGone",
  SERVICE_NOT_FOUND: "bookingTargetGone",
  INVALID_DURATION_OR_PRICE: "bookingServiceOption",
} as const;

export type BookingApiCodeMappedMessageKey =
  (typeof BOOKING_API_CODE_TO_MESSAGE_KEY)[keyof typeof BOOKING_API_CODE_TO_MESSAGE_KEY];

/** Ключи apiErrorToast для сценария создания брони (инлайн + тосты). */
export type BookingCreateMessageKey =
  | BookingApiCodeMappedMessageKey
  | "bookingGeneric"
  | "networkTitle";
