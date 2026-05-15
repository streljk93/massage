import { addDays } from 'date-fns';
import { AvailabilityOverrideType, AvailabilityRuleType } from '@prisma/client';
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
import { localIntervalBoundsInTimeZone } from '../../calendar/domain/calendar-timezone';
import { formatOccupiedSlotKey } from './occupancy-slot-key';

type ListingSlotWorkday = {
  startMinute: number;
  endMinute: number;
};

export type ListingAvailabilityResource = {
  specialistId: string;
  resourceId: string;
  timeZone: string;
};

export type ListingAvailabilityRule = {
  resourceId: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  type: AvailabilityRuleType;
};

export type ListingAvailabilityOverride = {
  resourceId: string;
  date: string;
  startsAt: Date | null;
  endsAt: Date | null;
  type: AvailabilityOverrideType;
};

const FULL_DAY: ListingSlotWorkday = {
  startMinute: 0,
  endMinute: 24 * 60,
};

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

function slotInstantsForWorkday(
  dayKey: string,
  workday: ListingSlotWorkday,
): Date[] {
  const [y, mo, d] = dayKey.split('-').map(Number);
  const dayStartMin = workday.startMinute;
  const lastStartMin = workday.endMinute - SLOT_GRID_MINUTES;
  const out: Date[] = [];
  if (dayStartMin > lastStartMin) {
    return out;
  }
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
    for (const S of slotInstantsForWorkday(dayKey, FULL_DAY)) {
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
  workday: ListingSlotWorkday = {
    startMinute: DEFAULT_WORKDAY.startHour * 60 + DEFAULT_WORKDAY.startMinute,
    endMinute: DEFAULT_WORKDAY.endHour * 60,
  },
): Date[] {
  const todayKey = formatListingCalendarYmd(now);
  const [ty, tm, td] = todayKey.split('-').map(Number);
  const startMidnight = vnWallClockToUtcDate(ty, tm, td, 0, 0);
  const out: Date[] = [];
  const days = Math.max(1, Math.min(90, Math.floor(calendarDays)));
  for (let i = 0; i < days; i++) {
    const dayStart = addDays(startMidnight, i);
    const dk = formatListingCalendarYmd(dayStart);
    out.push(...slotInstantsForWorkday(dk, workday));
  }
  return out;
}

function overrideOverlaps(
  overrideStart: Date | null,
  overrideEnd: Date | null,
  startsAt: Date,
  endsAt: Date,
): boolean {
  if (overrideStart == null || overrideEnd == null) {
    return true;
  }
  return (
    overrideStart.getTime() < endsAt.getTime() &&
    overrideEnd.getTime() > startsAt.getTime()
  );
}

function overrideCovers(
  overrideStart: Date | null,
  overrideEnd: Date | null,
  startsAt: Date,
  endsAt: Date,
): boolean {
  if (overrideStart == null || overrideEnd == null) {
    return true;
  }
  return (
    overrideStart.getTime() <= startsAt.getTime() &&
    overrideEnd.getTime() >= endsAt.getTime()
  );
}

function slotPassesAvailability(args: {
  resourceId: string;
  timeZone: string;
  startsAt: Date;
  endsAt: Date;
  rules: ListingAvailabilityRule[];
  overrides: ListingAvailabilityOverride[];
}): boolean {
  const localBounds = localIntervalBoundsInTimeZone(
    args.startsAt,
    args.endsAt,
    args.timeZone,
  );
  if (localBounds == null) {
    return false;
  }
  const { weekday, date, startMinute, endMinute } = localBounds;
  const resourceOverrides = args.overrides.filter(
    (o) => o.resourceId === args.resourceId && o.date === date,
  );
  const off = resourceOverrides.find(
    (o) =>
      o.type === AvailabilityOverrideType.off &&
      overrideOverlaps(o.startsAt, o.endsAt, args.startsAt, args.endsAt),
  );
  if (off != null) {
    return false;
  }
  const extra = resourceOverrides.find(
    (o) =>
      o.type === AvailabilityOverrideType.extra &&
      overrideCovers(o.startsAt, o.endsAt, args.startsAt, args.endsAt),
  );
  if (extra != null) {
    return true;
  }
  const resourceRules = args.rules.filter(
    (r) => r.resourceId === args.resourceId && r.weekday === weekday,
  );
  const workingRule = resourceRules.find(
    (r) =>
      r.type === AvailabilityRuleType.working &&
      r.startMinute <= startMinute &&
      r.endMinute >= endMinute,
  );
  if (workingRule == null) {
    return false;
  }
  const regularBreak = resourceRules.find(
    (r) =>
      r.type === AvailabilityRuleType.break &&
      r.startMinute < endMinute &&
      r.endMinute > startMinute,
  );
  return regularBreak == null;
}

export function computeAvailableListingSlotKeysPerSpecialist(args: {
  resources: ListingAvailabilityResource[];
  rules: ListingAvailabilityRule[];
  overrides: ListingAvailabilityOverride[];
  occupiedBySpecialist: Map<string, Set<string>>;
  now: Date;
  calendarDays: number;
}): Map<string, Set<string>> {
  const windowStart = args.now.getTime() - BOOKING_START_TOLERANCE_MS;
  const windowEnd =
    args.now.getTime() + listingCardPreviewWindowMs(args.calendarDays);
  const candidates = generateCandidateListingSlotInstants(
    args.now,
    args.calendarDays,
    FULL_DAY,
  );
  const out = new Map<string, Set<string>>();
  for (const resource of args.resources) {
    let specialistKeys = out.get(resource.specialistId);
    if (!specialistKeys) {
      specialistKeys = new Set();
      out.set(resource.specialistId, specialistKeys);
    }
    const occupied = args.occupiedBySpecialist.get(resource.specialistId);
    for (const startsAt of candidates) {
      const t = startsAt.getTime();
      if (t < windowStart || t > windowEnd) {
        continue;
      }
      const key = formatOccupiedSlotKey(startsAt);
      if (occupied?.has(key)) {
        continue;
      }
      const endsAt = new Date(t + SLOT_GRID_MINUTES * 60_000);
      if (
        slotPassesAvailability({
          resourceId: resource.resourceId,
          timeZone: resource.timeZone,
          startsAt,
          endsAt,
          rules: args.rules,
          overrides: args.overrides,
        })
      ) {
        specialistKeys.add(key);
      }
    }
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
