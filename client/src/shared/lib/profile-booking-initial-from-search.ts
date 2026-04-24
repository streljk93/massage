import type { BookingSlotSearch } from "@/shared/lib/booking-slot-search-params";
import { slotTimeToMinutes } from "@/views/specialist-profile/lib/filter-slots-for-duration";

export type ProfileSlotGrid = {
  slotCalendarDates: string[];
  timeSlotsByDay: string[][];
};

/** Подпись слота из сетки, совпадающая с временем из URL (trim + совпадение по минутам суток). */
export function resolveSlotLabelInDay(
  slots: string[],
  timeFromUrl: string,
): string | null {
  const want = timeFromUrl.trim();
  if (!want) {
    return null;
  }
  const exact = slots.find((s) => s.trim() === want);
  if (exact !== undefined) {
    return exact;
  }
  const wantMin = slotTimeToMinutes(want);
  if (Number.isNaN(wantMin)) {
    return null;
  }
  const byMin = slots.find(
    (s) => slotTimeToMinutes(s.trim()) === wantMin,
  );
  return byMin ?? null;
}

export function initialDayAndSlotFromSearch(
  profile: ProfileSlotGrid,
  search: BookingSlotSearch | null,
): { dayIndex: number; slot: string } {
  if (!search) {
    return { dayIndex: 0, slot: "" };
  }
  const dayIdx = profile.slotCalendarDates.findIndex(
    (d) => d === search.calendarDate,
  );
  if (dayIdx < 0) {
    return { dayIndex: 0, slot: "" };
  }
  const slots = profile.timeSlotsByDay[dayIdx] ?? [];
  const resolved = resolveSlotLabelInDay(slots, search.time);
  if (resolved == null) {
    const fallback = search.time.trim();
    if (fallback === "") {
      return { dayIndex: 0, slot: "" };
    }
    return { dayIndex: dayIdx, slot: fallback };
  }
  return { dayIndex: dayIdx, slot: resolved };
}
