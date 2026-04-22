/** Как на бэкенде: витрина в Asia/Ho_Chi_Minh. */
const DISPLAY_TZ = "Asia/Ho_Chi_Minh";

export type DirectorySlotGroup = {
  calendarDate: string;
  times: string[];
};

export type DirectoryCalendarDay = {
  weekdayKey:
    | "sun"
    | "mon"
    | "tue"
    | "wed"
    | "thu"
    | "fri"
    | "sat";
  dayOfMonth: number;
};

function vnWallClockToUtcDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const p = (n: number) => String(n).padStart(2, "0");
  return new Date(
    `${year}-${p(month)}-${p(day)}T${p(hour)}:${p(minute)}:00+07:00`,
  );
}

/**
 * «Сегодня» и «завтра» в календаре витрины (как `listingCalendarDayKeys` на бэкенде).
 */
export function listingCalendarDayKeys(now: Date): {
  todayKey: string;
  tomorrowKey: string;
} {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayKey = fmt.format(now);
  const [ty, tm, td] = todayKey.split("-").map(Number);
  const tomorrowStart = new Date(
    vnWallClockToUtcDate(ty, tm, td, 0, 0).getTime() + 86_400_000,
  );
  const tomorrowKey = fmt.format(tomorrowStart);
  return { todayKey, tomorrowKey };
}

function vnCalendarDay(date: Date): DirectoryCalendarDay {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: DISPLAY_TZ,
    weekday: "short",
    day: "numeric",
  });
  const parts = fmt.formatToParts(date);
  const wd = parts.find((p) => p.type === "weekday")?.value;
  const dayNum = Number(parts.find((p) => p.type === "day")?.value);
  const map: Record<string, DirectoryCalendarDay["weekdayKey"]> = {
    Sun: "sun",
    Mon: "mon",
    Tue: "tue",
    Wed: "wed",
    Thu: "thu",
    Fri: "fri",
    Sat: "sat",
  };
  return {
    weekdayKey: map[wd ?? ""] ?? "mon",
    dayOfMonth: dayNum,
  };
}

/** Слоты по календарным дням витрины + подписи дней. */
export function availabilityFromDirectorySlotGroups(
  slotGroups: DirectorySlotGroup[] | null | undefined,
  _now: Date,
): {
  calendarDays: DirectoryCalendarDay[];
  timeSlotsByDay: string[][];
  slotCalendarDates: string[];
} {
  const list = slotGroups ?? [];
  const sorted = [...list].sort((a, b) =>
    a.calendarDate.localeCompare(b.calendarDate),
  );

  const calendarDays: DirectoryCalendarDay[] = [];
  const timeSlotsByDay: string[][] = [];
  const slotCalendarDates: string[] = [];

  for (const g of sorted) {
    slotCalendarDates.push(g.calendarDate);
    const [y, mo, d] = g.calendarDate.split("-").map(Number);
    const noon = vnWallClockToUtcDate(y, mo, d, 12, 0);
    calendarDays.push(vnCalendarDay(noon));
    const uniq = [...new Set(g.times ?? [])].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
    timeSlotsByDay.push(uniq);
  }

  return { calendarDays, timeSlotsByDay, slotCalendarDates };
}
