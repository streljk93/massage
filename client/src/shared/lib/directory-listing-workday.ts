import { SLOT_GRID_MINUTES } from "./directory-slot-grid-constants";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** `9:0` / `9:00` → `09:00` (как на бэкенде). */
export function normalizeDirectorySlotTimeHm(raw: string): string {
  const parts = raw.trim().split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? 0);
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return raw.trim();
  }
  return `${pad2(h)}:${pad2(m)}`;
}

/** Как `DEFAULT_LISTING_WORKDAY_*` на бэкенде. */
export const DEFAULT_LISTING_WORKDAY_START_MINUTE = 8 * 60;
export const DEFAULT_LISTING_WORKDAY_END_MINUTE = 22 * 60;

export type DirectoryListingWorkday = {
  startMinute: number;
  endMinute: number;
};

const DEFAULT_DIR_WORKDAY: DirectoryListingWorkday = {
  startMinute: DEFAULT_LISTING_WORKDAY_START_MINUTE,
  endMinute: DEFAULT_LISTING_WORKDAY_END_MINUTE,
};

/**
 * Сетка 30 мин; при несогласованных числах — 8:00–22:00.
 * Должно совпадать по смыслу с `normalizeDirectoryListingWorkdayBounds` на сервере.
 */
export function normalizeClientListingWorkday(
  startMinute: number | null | undefined,
  endMinute: number | null | undefined,
): DirectoryListingWorkday {
  if (
    startMinute == null ||
    endMinute == null ||
    !Number.isFinite(startMinute) ||
    !Number.isFinite(endMinute)
  ) {
    return { ...DEFAULT_DIR_WORKDAY };
  }
  let a =
    Math.floor(Math.max(0, startMinute) / SLOT_GRID_MINUTES) * SLOT_GRID_MINUTES;
  let b =
    Math.ceil(Math.max(0, endMinute) / SLOT_GRID_MINUTES) * SLOT_GRID_MINUTES;
  b = Math.min(24 * 60, b);
  if (a >= b || b - a < SLOT_GRID_MINUTES) {
    return { ...DEFAULT_DIR_WORKDAY };
  }
  return { startMinute: a, endMinute: b };
}

export function workdayOrDefault(
  w: DirectoryListingWorkday | null | undefined,
): DirectoryListingWorkday {
  if (w == null) {
    return { ...DEFAULT_DIR_WORKDAY };
  }
  return normalizeClientListingWorkday(w.startMinute, w.endMinute);
}
