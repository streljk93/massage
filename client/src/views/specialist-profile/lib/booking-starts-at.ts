/** Как на витрине: слоты в таймзоне Вьетнама. */
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

/** Следующий календарный день в VN относительно `now` (полдень UTC-якорь). */
export function vnTomorrowFromNow(now: Date): Date {
  return addCalendarDaysVn(now, 1);
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
