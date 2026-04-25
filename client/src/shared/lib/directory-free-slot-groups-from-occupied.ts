import { addDays } from "date-fns";
import type { DirectorySlotGroupSeed } from "@/shared/lib/directory-slot-group-seed";
import type { DirectoryListingWorkday } from "@/shared/lib/directory-listing-workday";
import {
  DEFAULT_LISTING_WORKDAY_END_MINUTE,
  DEFAULT_LISTING_WORKDAY_START_MINUTE,
  normalizeDirectorySlotTimeHm,
  workdayOrDefault,
} from "@/shared/lib/directory-listing-workday";
import { SLOT_GRID_MINUTES } from "@/shared/lib/directory-slot-grid-constants";
import {
  formatListingCalendarYmd,
  formatListingClockHm,
  formatListingOccupiedSlotKey,
  vnWallClockToUtcDate,
} from "@/shared/lib/datetime/vn-listing-datetime";

const DEFAULT_WORKDAY: DirectoryListingWorkday = {
  startMinute: DEFAULT_LISTING_WORKDAY_START_MINUTE,
  endMinute: DEFAULT_LISTING_WORKDAY_END_MINUTE,
};

const BOOKING_START_TOLERANCE_MS = 120_000;

const LISTING_CARD_PREVIEW_TAIL_MS = 26 * 60 * 60 * 1000;

function listingCardPreviewWindowMs(calendarDays: number): number {
  const days = Math.max(1, Math.min(90, Math.floor(calendarDays)));
  return days * 24 * 60 * 60 * 1000 + LISTING_CARD_PREVIEW_TAIL_MS;
}

function slotInstantsForWorkday(
  dayKey: string,
  workday: DirectoryListingWorkday,
): Date[] {
  const [y, mo, d] = dayKey.split("-").map(Number);
  const dayStartMin = workday.startMinute;
  const lastStartMin = workday.endMinute - SLOT_GRID_MINUTES;
  if (dayStartMin > lastStartMin) {
    return [];
  }
  const out: Date[] = [];
  for (let m = dayStartMin; m <= lastStartMin; m += SLOT_GRID_MINUTES) {
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    out.push(vnWallClockToUtcDate(y, mo, d, hh, mm));
  }
  return out;
}

function generateCandidateListingSlotInstants(
  now: Date,
  calendarDays: number,
  workday: DirectoryListingWorkday,
): Date[] {
  const todayKey = formatListingCalendarYmd(now);
  const [ty, tm, td] = todayKey.split("-").map(Number);
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

/**
 * На случай рассхождения сетки и строк, а также дней без ни одного реально
 * бронируемого времени: убрать прошедшие `HH:mm` и пустые дни.
 */
function pruneDirectorySlotSeedsToBookableFromNow(
  groups: readonly DirectorySlotGroupSeed[],
  now: Date,
): DirectorySlotGroupSeed[] {
  const minMs = now.getTime() - BOOKING_START_TOLERANCE_MS;
  const out: DirectorySlotGroupSeed[] = [];
  for (const g of groups) {
    const kept: string[] = [];
    for (const raw of g.times ?? []) {
      const norm = normalizeDirectorySlotTimeHm(raw);
      const parts = norm.split(":");
      const hh = Number(parts[0]);
      const mm = Number(parts[1] ?? 0);
      if (!Number.isFinite(hh) || !Number.isFinite(mm)) {
        continue;
      }
      const [y, mo, d] = g.calendarDate.split("-").map(Number);
      if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) {
        continue;
      }
      const inst = vnWallClockToUtcDate(y, mo, d, hh, mm);
      if (inst.getTime() >= minMs) {
        kept.push(norm);
      }
    }
    const uniq = [...new Set(kept)].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
    if (uniq.length > 0) {
      out.push({ calendarDate: g.calendarDate, times: uniq });
    }
  }
  return out;
}

function buildSlotGroupsFromStarts(
  startsAtList: Date[],
): DirectorySlotGroupSeed[] {
  const byDay = new Map<string, string[]>();
  for (const s of startsAtList) {
    const k = formatListingCalendarYmd(s);
    const label = formatListingClockHm(s);
    const arr = byDay.get(k) ?? [];
    arr.push(label);
    byDay.set(k, arr);
  }

  const dates = [...byDay.keys()].sort();
  const out: DirectorySlotGroupSeed[] = [];
  for (const calendarDate of dates) {
    const times = [...new Set(byDay.get(calendarDate) ?? [])].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
    if (times.length > 0) {
      out.push({ calendarDate, times });
    }
  }
  return out;
}

function occupiedKeySetFromGroups(
  groups: readonly DirectorySlotGroupSeed[],
): Set<string> {
  const s = new Set<string>();
  for (const g of groups) {
    for (const t of g.times ?? []) {
      s.add(`${g.calendarDate}|${t.trim()}`);
    }
  }
  return s;
}

/**
 * max(listingCardPreview.calendarDays, profileSlotPreview.calendarDays) на сервере
 * при дефолтных env (1 и 14) даёт 14 — то же окно, что у `getUnifiedDirectorySlotPreviewCalendarDays`.
 */
export const UNIFIED_DIRECTORY_SLOT_PREVIEW_CALENDAR_DAYS = 14;

type WorkdayInput = DirectoryListingWorkday | null | undefined;

/** Свободные слоты мастера: сетка графика салона (или 8:00–22:00) минус занятые. */
export function freeDirectorySlotGroupSeedsFromSpecialistOccupied(
  occupiedSlotGroups: readonly DirectorySlotGroupSeed[],
  now: Date,
  calendarDays: number = UNIFIED_DIRECTORY_SLOT_PREVIEW_CALENDAR_DAYS,
  workday: WorkdayInput = DEFAULT_WORKDAY,
): DirectorySlotGroupSeed[] {
  const wd = workdayOrDefault(workday);
  const occupied = occupiedKeySetFromGroups(occupiedSlotGroups);
  const windowStart = now.getTime() - BOOKING_START_TOLERANCE_MS;
  const windowEnd = now.getTime() + listingCardPreviewWindowMs(calendarDays);
  const free: Date[] = [];
  for (const S of generateCandidateListingSlotInstants(
    now,
    calendarDays,
    wd,
  )) {
    const t = S.getTime();
    if (t < windowStart || t > windowEnd) {
      continue;
    }
    if (!occupied.has(formatListingOccupiedSlotKey(S))) {
      free.push(S);
    }
  }
  return pruneDirectorySlotSeedsToBookableFromNow(
    buildSlotGroupsFromStarts(free),
    now,
  );
}

/**
 * Свободные слоты салона: график организации; ячейка доступна, если хотя бы у одного
 * мастера витрины нет брони на этот ключ.
 */
export function freeDirectorySlotGroupSeedsForOrganization(
  perSpecialist: ReadonlyArray<{
    specialistId: string;
    keys: readonly string[];
  }>,
  now: Date,
  calendarDays: number = UNIFIED_DIRECTORY_SLOT_PREVIEW_CALENDAR_DAYS,
  workday: WorkdayInput = DEFAULT_WORKDAY,
): DirectorySlotGroupSeed[] {
  const wd = workdayOrDefault(workday);
  const bySpec = new Map(
    perSpecialist.map((p) => [p.specialistId, new Set(p.keys)] as const),
  );
  if (bySpec.size === 0) {
    return [];
  }
  const windowStart = now.getTime() - BOOKING_START_TOLERANCE_MS;
  const windowEnd = now.getTime() + listingCardPreviewWindowMs(calendarDays);
  const free: Date[] = [];
  for (const S of generateCandidateListingSlotInstants(
    now,
    calendarDays,
    wd,
  )) {
    const t = S.getTime();
    if (t < windowStart || t > windowEnd) {
      continue;
    }
    const k = formatListingOccupiedSlotKey(S);
    let anySpecialistFree = false;
    for (const occ of bySpec.values()) {
      if (!occ.has(k)) {
        anySpecialistFree = true;
        break;
      }
    }
    if (anySpecialistFree) {
      free.push(S);
    }
  }
  return pruneDirectorySlotSeedsToBookableFromNow(
    buildSlotGroupsFromStarts(free),
    now,
  );
}
