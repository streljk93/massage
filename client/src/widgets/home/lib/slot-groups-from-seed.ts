import type { AvailabilitySlotGroup } from "@/shared/ui";
import { listingCalendarDayKeys } from "@/shared/lib/directory-slot-calendar";
import type { SlotGroupSeed } from "./mock-data";

function resolveSeedCalendarDate(g: SlotGroupSeed, now: Date): string {
  if ("calendarDate" in g) {
    return g.calendarDate;
  }
  const { todayKey, tomorrowKey } = listingCalendarDayKeys(now);
  return g.dayKey === "tomorrow" ? tomorrowKey : todayKey;
}

function dayLabelForCalendarDate(calendarDate: string): string {
  const [y, mo, d] = calendarDate.split("-").map(Number);
  const noon = new Date(
    `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}T12:00:00+07:00`,
  );
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(noon);
}

/**
 * Карточки в поиске / главной: подпись дня по календарной дате витрины.
 * `maxGroups` ограничивает полосу на карточке (полный список дней — на профиле).
 */
export function slotGroupsFromSeed(
  groups: SlotGroupSeed[] | undefined | null,
  _tSlots: (key: string) => string,
  opts?: { now?: Date; maxGroups?: number },
): AvailabilitySlotGroup[] {
  const now = opts?.now ?? new Date();
  const raw = groups ?? [];
  const capped =
    opts?.maxGroups != null && opts.maxGroups >= 0
      ? raw.slice(0, opts.maxGroups)
      : raw;

  return capped.map((g) => {
    const calendarDate = resolveSeedCalendarDate(g, now);
    return {
      calendarDate,
      dayLabel: dayLabelForCalendarDate(calendarDate),
      times: g.times ?? [],
    };
  });
}
