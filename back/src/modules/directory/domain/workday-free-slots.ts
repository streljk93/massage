import { addDays } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import {
  BOOKING_START_TOLERANCE_MS,
  DEFAULT_WORKDAY,
  LISTING_DISPLAY_TZ,
  SLOT_GRID_MINUTES,
} from '../../../common/availability/listing-slot-policy';
import { formatOccupiedSlotKey } from './occupancy-slot-key';

const WINDOW_FUTURE_MS = 48 * 60 * 60 * 1000;

function collectDayKeysOverlapping(startsAt: Date, endsAt: Date): string[] {
  const dayKeys: string[] = [];
  const seen = new Set<string>();
  let cursor = startsAt.getTime();
  const endMs = endsAt.getTime();
  while (cursor < endMs) {
    const dk = formatInTimeZone(
      new Date(cursor),
      LISTING_DISPLAY_TZ,
      'yyyy-MM-dd',
    );
    if (!seen.has(dk)) {
      seen.add(dk);
      dayKeys.push(dk);
    }
    const z = toZonedTime(new Date(cursor), LISTING_DISPLAY_TZ);
    const nextMidnight = fromZonedTime(
      new Date(z.getFullYear(), z.getMonth(), z.getDate() + 1, 0, 0, 0, 0),
      LISTING_DISPLAY_TZ,
    );
    cursor = nextMidnight.getTime();
  }
  return dayKeys;
}

function slotInstantsForWorkday(dayKey: string): Date[] {
  const [y, mo, d] = dayKey.split('-').map(Number);
  const dayStartMin =
    DEFAULT_WORKDAY.startHour * 60 + DEFAULT_WORKDAY.startMinute;
  const lastStartMin = DEFAULT_WORKDAY.endHour * 60 - SLOT_GRID_MINUTES;
  const out: Date[] = [];
  for (let m = dayStartMin; m <= lastStartMin; m += SLOT_GRID_MINUTES) {
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    out.push(
      fromZonedTime(new Date(y, mo - 1, d, hh, mm, 0, 0), LISTING_DISPLAY_TZ),
    );
  }
  return out;
}

/**
 * Ключи `yyyy-MM-dd|HH:mm` для всех ячеек сетки 30 мин, пересекающихся
 * с полуинтервалом брони [startsAt, endsAt).
 */
export function expandIntervalToOccupiedSlotKeys(
  startsAt: Date,
  endsAt: Date,
): Set<string> {
  const keys = new Set<string>();
  if (endsAt.getTime() <= startsAt.getTime()) {
    return keys;
  }
  for (const dayKey of collectDayKeysOverlapping(startsAt, endsAt)) {
    for (const S of slotInstantsForWorkday(dayKey)) {
      const slotEnd = S.getTime() + SLOT_GRID_MINUTES * 60_000;
      if (S.getTime() < endsAt.getTime() && slotEnd > startsAt.getTime()) {
        keys.add(formatOccupiedSlotKey(S));
      }
    }
  }
  return keys;
}

export function mergeBookingsToOccupiedKeysPerSpecialist(
  rows: { specialistId: string; startsAt: Date; endsAt: Date }[],
): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const r of rows) {
    let set = m.get(r.specialistId);
    if (!set) {
      set = new Set();
      m.set(r.specialistId, set);
    }
    for (const k of expandIntervalToOccupiedSlotKeys(r.startsAt, r.endsAt)) {
      set.add(k);
    }
  }
  return m;
}

/** Кандидаты витрины: все старты сетки на «сегодня» и «завтра» в DISPLAY_TZ. */
export function generateCandidateListingSlotInstants(now: Date): Date[] {
  const todayKey = formatInTimeZone(now, LISTING_DISPLAY_TZ, 'yyyy-MM-dd');
  const zonedNow = toZonedTime(now, LISTING_DISPLAY_TZ);
  const tomorrowKey = formatInTimeZone(
    addDays(zonedNow, 1),
    LISTING_DISPLAY_TZ,
    'yyyy-MM-dd',
  );
  return [
    ...slotInstantsForWorkday(todayKey),
    ...slotInstantsForWorkday(tomorrowKey),
  ];
}

/** Свободные старты слотов для карточки (окно как у прежнего запроса к БД). */
export function computeFreeSlotStartsForSpecialist(
  now: Date,
  occupiedKeys: Set<string>,
): Date[] {
  const windowStart = now.getTime() - BOOKING_START_TOLERANCE_MS;
  const windowEnd = now.getTime() + WINDOW_FUTURE_MS;
  const out: Date[] = [];
  for (const S of generateCandidateListingSlotInstants(now)) {
    const t = S.getTime();
    if (t < windowStart || t > windowEnd) {
      continue;
    }
    if (!occupiedKeys.has(formatOccupiedSlotKey(S))) {
      out.push(S);
    }
  }
  return out;
}
