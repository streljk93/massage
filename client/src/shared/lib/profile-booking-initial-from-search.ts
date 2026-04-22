import type { BookingUrlSlotDay } from "@/shared/lib/booking-slot-search-params";

export type ProfileSlotGrid = {
  slotDayKeys: Array<BookingUrlSlotDay>;
  timeSlotsByDay: string[][];
};

export type BookingSlotSearch = { dayKey: BookingUrlSlotDay; time: string };

export function initialDayAndSlotFromSearch(
  profile: ProfileSlotGrid,
  search: BookingSlotSearch | null,
): { dayIndex: number; slot: string } {
  if (!search) {
    return { dayIndex: 0, slot: "" };
  }
  const dayIdx = profile.slotDayKeys.findIndex((k) => k === search.dayKey);
  if (dayIdx < 0) {
    return { dayIndex: 0, slot: "" };
  }
  const slots = profile.timeSlotsByDay[dayIdx] ?? [];
  if (!slots.includes(search.time)) {
    return { dayIndex: 0, slot: "" };
  }
  return { dayIndex: dayIdx, slot: search.time };
}
