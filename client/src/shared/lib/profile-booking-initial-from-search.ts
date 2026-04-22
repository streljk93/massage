import type { BookingSlotSearch } from "@/shared/lib/booking-slot-search-params";

export type ProfileSlotGrid = {
  slotCalendarDates: string[];
  timeSlotsByDay: string[][];
};

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
  if (!slots.includes(search.time)) {
    return { dayIndex: 0, slot: "" };
  }
  return { dayIndex: dayIdx, slot: search.time };
}
