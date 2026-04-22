import { vnWallClockToUtcDate } from "@/shared/lib/datetime/vn-listing-datetime";

export {
  vnCalendarYmdString,
  vnTomorrowFromNow,
} from "@/shared/lib/datetime/vn-listing-datetime";

function parseSlotHm(slot: string): { h: number; m: number } {
  const parts = slot.trim().split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  return {
    h: Number.isFinite(h) ? h : 0,
    m: Number.isFinite(m) ? m : 0,
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * ISO UTC для начала слота: календарная дата витрины (yyyy-MM-dd, VN) + время HH:mm.
 */
export function bookingStartsAtIsoUtc(args: {
  calendarDate: string;
  slotTime: string;
}): string {
  const parts = args.calendarDate.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  const { h, m: min } = parseSlotHm(args.slotTime);
  return vnWallClockToUtcDate(y, m, d, h, min).toISOString();
}
