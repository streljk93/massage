import { formatInTimeZone } from 'date-fns-tz';

const DISPLAY_TZ = 'Asia/Ho_Chi_Minh';

/** Ключ для сопоставления слота витрины с `Booking.startsAt` (день + время в VN). */
export function formatOccupiedSlotKey(startsAt: Date): string {
  const dayKey = formatInTimeZone(startsAt, DISPLAY_TZ, 'yyyy-MM-dd');
  const timeLabel = formatInTimeZone(startsAt, DISPLAY_TZ, 'HH:mm');
  return `${dayKey}|${timeLabel}`;
}
