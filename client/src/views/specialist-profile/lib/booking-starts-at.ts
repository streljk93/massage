/** Как на витрине и в `specialist-profile-from-api`: слоты в таймзоне Вьетнама. */
const DISPLAY_TZ = "Asia/Ho_Chi_Minh";

const VN_OFFSET = "+07:00";

function vnYmd(d: Date): { y: number; m: number; d: number } {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const [y, m, day] = s.split("-").map(Number);
  return { y, m, d: day };
}

function addCalendarDaysVn(from: Date, delta: number): Date {
  const { y, m, d } = vnYmd(from);
  return new Date(Date.UTC(y, m - 1, d + delta, 12, 0, 0));
}

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
 * ISO UTC для начала слота: день «сегодня/завтра» в VN + время из строки слота.
 */
export function bookingStartsAtIsoUtc(args: {
  slotDayKey: "today" | "tomorrow";
  slotTime: string;
  now?: Date;
}): string {
  const now = args.now ?? new Date();
  const ref =
    args.slotDayKey === "today" ? now : addCalendarDaysVn(now, 1);
  const { y, m, d } = vnYmd(ref);
  const { h, m: min } = parseSlotHm(args.slotTime);
  const local = `${y}-${pad2(m)}-${pad2(d)}T${pad2(h)}:${pad2(min)}:00${VN_OFFSET}`;
  return new Date(local).toISOString();
}

/** `YYYY-MM-DD` в календаре Вьетнама для момента времени. */
export function vnCalendarYmdString(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function vnTomorrowFromNow(now: Date): Date {
  return addCalendarDaysVn(now, 1);
}
