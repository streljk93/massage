import type { Prisma } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import {
  LISTING_DISPLAY_TZ,
  listingCalendarDayKeys,
} from '../../../common/availability/listing-slot-policy';

export type ListingSlotGroupSeed = {
  /** Календарная дата витрины, yyyy-MM-dd (Asia/Ho_Chi_Minh). */
  calendarDate: string;
  times: string[];
};

const ISO_CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Единый вид `HH:mm` для ключей занятости и времени в JSON (`9:00` → `09:00`). */
export function normalizeListingSlotTimeLabel(raw: string): string {
  const parts = raw.trim().split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? 0);
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return raw.trim();
  }
  return `${pad2(h)}:${pad2(m)}`;
}

/** Убирает дни строго до «сегодня» в таймзоне витрины. */
export function dropPastListingSlotGroups(
  groups: ListingSlotGroupSeed[],
  now: Date,
): ListingSlotGroupSeed[] {
  const minDate = formatInTimeZone(now, LISTING_DISPLAY_TZ, 'yyyy-MM-dd');
  return groups.filter((g) => g.calendarDate >= minDate);
}

/**
 * Разбор JSON из `listingSlotGroups` (Prisma).
 * Поддержка: `calendarDate` / `date`, либо устаревшие `dayKey` today|tomorrow относительно `now`.
 */
export function parseListingSlotGroups(
  raw: Prisma.JsonValue | null | undefined,
  now: Date,
): ListingSlotGroupSeed[] {
  if (raw == null || !Array.isArray(raw)) {
    return [];
  }
  const { todayKey, tomorrowKey } = listingCalendarDayKeys(now);
  const out: ListingSlotGroupSeed[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const o = item as {
      dayKey?: unknown;
      calendarDate?: unknown;
      date?: unknown;
      times?: unknown;
    };
    const times = o.times;
    if (!Array.isArray(times)) {
      continue;
    }
    const filteredTimes = times.filter((t): t is string => typeof t === 'string');

    let calendarDate: string | null = null;
    if (
      typeof o.calendarDate === 'string' &&
      ISO_CALENDAR_DATE.test(o.calendarDate)
    ) {
      calendarDate = o.calendarDate;
    } else if (typeof o.date === 'string' && ISO_CALENDAR_DATE.test(o.date)) {
      calendarDate = o.date;
    } else if (o.dayKey === 'today') {
      calendarDate = todayKey;
    } else if (o.dayKey === 'tomorrow') {
      calendarDate = tomorrowKey;
    }
    if (!calendarDate) {
      continue;
    }
    out.push({ calendarDate, times: filteredTimes });
  }
  return out;
}
