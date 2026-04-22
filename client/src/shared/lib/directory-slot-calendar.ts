/** Как на бэкенде (`build-card-slot-groups`): витрина в таймзоне Вьетнама. */
const DISPLAY_TZ = "Asia/Ho_Chi_Minh";

export type DirectorySlotGroup = {
  dayKey: "today" | "tomorrow";
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

/** Слоты витрины «сегодня/завтра» + календарные дни в DISPLAY_TZ. */
export function availabilityFromDirectorySlotGroups(
  slotGroups: DirectorySlotGroup[] | null | undefined,
  now: Date,
): {
  calendarDays: DirectoryCalendarDay[];
  timeSlotsByDay: string[][];
  slotDayKeys: Array<"today" | "tomorrow">;
} {
  const list = slotGroups ?? [];
  const calendarDays: DirectoryCalendarDay[] = [];
  const timeSlotsByDay: string[][] = [];
  const slotDayKeys: Array<"today" | "tomorrow"> = [];

  const sorted = [...list].sort((a, b) => {
    if (a.dayKey === "today" && b.dayKey === "tomorrow") return -1;
    if (a.dayKey === "tomorrow" && b.dayKey === "today") return 1;
    return 0;
  });

  for (const g of sorted) {
    slotDayKeys.push(g.dayKey === "tomorrow" ? "tomorrow" : "today");
    const dateRef = g.dayKey === "today" ? now : addCalendarDaysVn(now, 1);
    calendarDays.push(vnCalendarDay(dateRef));
    const uniq = [...new Set(g.times ?? [])].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
    timeSlotsByDay.push(uniq);
  }

  return { calendarDays, timeSlotsByDay, slotDayKeys };
}
