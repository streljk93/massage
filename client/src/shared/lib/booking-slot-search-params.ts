/** Query-параметры для предзаполнения даты/времени записи с витрины. */
export const BOOKING_URL_SLOT_DAY = "slotDay";
export const BOOKING_URL_SLOT_TIME = "slotTime";

const ISO_CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

export type BookingSlotSearch = { calendarDate: string; time: string };

export function parseBookingSlotSearchParams(
  searchParams: URLSearchParams,
): BookingSlotSearch | null {
  const dayRaw = searchParams.get(BOOKING_URL_SLOT_DAY)?.trim() ?? "";
  const time = searchParams.get(BOOKING_URL_SLOT_TIME)?.trim() ?? "";
  if (time === "" || dayRaw === "") {
    return null;
  }
  if (!ISO_CALENDAR_DAY.test(dayRaw)) {
    return null;
  }
  return { calendarDate: dayRaw, time };
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
): BookingSlotSearch | null {
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
