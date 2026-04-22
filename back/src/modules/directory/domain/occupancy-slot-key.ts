import { formatInTimeZone } from 'date-fns-tz';
import { LISTING_DISPLAY_TZ } from '../../../common/availability/listing-slot-policy';

/** Ключ для сопоставления слота витрины с интервалом брони (день + время в таймзоне витрины). */
export function formatOccupiedSlotKey(startsAt: Date): string {
  const dayKey = formatInTimeZone(startsAt, LISTING_DISPLAY_TZ, 'yyyy-MM-dd');
  const timeLabel = formatInTimeZone(startsAt, LISTING_DISPLAY_TZ, 'HH:mm');
  return `${dayKey}|${timeLabel}`;
}
