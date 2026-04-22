/** Query-параметры для предзаполнения даты/времени записи с витрины. */
export const BOOKING_URL_SLOT_DAY = "slotDay";
export const BOOKING_URL_SLOT_TIME = "slotTime";

export type BookingUrlSlotDay = "today" | "tomorrow";

export function parseBookingSlotSearchParams(
  searchParams: URLSearchParams,
): { dayKey: BookingUrlSlotDay; time: string } | null {
  const dayRaw = searchParams.get(BOOKING_URL_SLOT_DAY);
  const time = searchParams.get(BOOKING_URL_SLOT_TIME)?.trim() ?? "";
  if (time === "") {
    return null;
  }
  if (dayRaw !== "today" && dayRaw !== "tomorrow") {
    return null;
  }
  return { dayKey: dayRaw, time };
}

function nextSearchParamValue(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return undefined;
}

/** Парсинг `searchParams` страницы Next.js (App Router). */
export function parseBookingSlotFromNextSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): { dayKey: BookingUrlSlotDay; time: string } | null {
  const params = new URLSearchParams();
  const day = nextSearchParamValue(searchParams[BOOKING_URL_SLOT_DAY]);
  const time = nextSearchParamValue(searchParams[BOOKING_URL_SLOT_TIME]);
  if (day) {
    params.set(BOOKING_URL_SLOT_DAY, day);
  }
  if (time) {
    params.set(BOOKING_URL_SLOT_TIME, time);
  }
  return parseBookingSlotSearchParams(params);
}
