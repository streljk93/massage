import { addDays } from 'date-fns';
import {
  BOOKING_START_TOLERANCE_MS,
  DEFAULT_WORKDAY,
  listingCardPreviewWindowMs,
  SLOT_GRID_MINUTES,
} from '../../../common/availability/listing-slot-policy';
import {
  formatListingCalendarYmd,
  vnWallClockToUtcDate,
} from '../../../common/datetime/vn-listing-datetime';
import { formatOccupiedSlotKey } from './occupancy-slot-key';

function collectDayKeysOverlapping(startsAt: Date, endsAt: Date): string[] {
  const dayKeys: string[] = [];
  const seen = new Set<string>();
  let cursor = startsAt.getTime();
  const endMs = endsAt.getTime();
  while (cursor < endMs) {
    const dk = formatListingCalendarYmd(new Date(cursor));
    if (!seen.has(dk)) {
      seen.add(dk);
      dayKeys.push(dk);
    }
    const [y, mo, d] = dk.split('-').map(Number);
    cursor = addDays(vnWallClockToUtcDate(y, mo, d, 0, 0), 1).getTime();
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
    out.push(vnWallClockToUtcDate(y, mo, d, hh, mm));
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

export function mergeCalendarEventsToOccupiedKeysPerSpecialist(
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

/**
 * Кандидаты превью витрины: сетка на первые `calendarDays` от «сегодня» в DISPLAY_TZ.
 * Значение дней приходит из конфига (`listingCardPreview.calendarDays`).
 */
export function generateCandidateListingSlotInstants(
  now: Date,
  calendarDays: number,
): Date[] {
  const todayKey = formatListingCalendarYmd(now);
  const [ty, tm, td] = todayKey.split('-').map(Number);
  const startMidnight = vnWallClockToUtcDate(ty, tm, td, 0, 0);
  const out: Date[] = [];
  const days = Math.max(1, Math.min(90, Math.floor(calendarDays)));
  for (let i = 0; i < days; i++) {
    const dayStart = addDays(startMidnight, i);
    const dk = formatListingCalendarYmd(dayStart);
    out.push(...slotInstantsForWorkday(dk));
  }
  return out;
}

/** Свободные старты слотов для карточки (окно как у выборки броней под занятость). */
export function computeFreeSlotStartsForSpecialist(
  now: Date,
  occupiedKeys: Set<string>,
  calendarDays: number,
): Date[] {
  const windowStart = now.getTime() - BOOKING_START_TOLERANCE_MS;
  const windowEnd = now.getTime() + listingCardPreviewWindowMs(calendarDays);
  const out: Date[] = [];
  for (const S of generateCandidateListingSlotInstants(now, calendarDays)) {
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
