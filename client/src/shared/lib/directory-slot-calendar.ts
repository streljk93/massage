import { LISTING_DISPLAY_TZ, vnWallClockToUtcDate } from "@/shared/lib/datetime/vn-listing-datetime";

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

function vnCalendarDay(date: Date): DirectoryCalendarDay {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: LISTING_DISPLAY_TZ,
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
