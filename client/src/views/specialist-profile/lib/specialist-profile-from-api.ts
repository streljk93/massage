import type { BookableServiceOption } from "@/entities/services";
import type { SpecialistsGetByIdResponse } from "@/shared/api";
import { specialistCardSeedFromApi } from "@/widgets/home/lib/directory-cards-from-api";
import type {
  SpecialistCalendarDay,
  SpecialistProfileData,
} from "../model/specialist-profile-data";

/** Как на бэкенде (`build-card-slot-groups`): витрина в таймзоне Вьетнама. */
const DISPLAY_TZ = "Asia/Ho_Chi_Minh";

function bookableServicesFromApi(
  detail: SpecialistsGetByIdResponse,
): BookableServiceOption[] {
  const list = detail.bookableServices ?? [];
  return list.map((s) => ({
    id: s.id,
    title: s.name,
    durationMinutes: s.durationMinutes as readonly number[],
    priceVndByDuration: s.priceVndByDuration as readonly number[],
  }));
}

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

/** Следующий календарный день в таймзоне витрины (как «завтра» в каталоге). */
function addCalendarDaysVn(from: Date, delta: number): Date {
  const { y, m, d } = vnYmd(from);
  return new Date(Date.UTC(y, m - 1, d + delta, 12, 0, 0));
}

function vnCalendarDay(date: Date): SpecialistCalendarDay {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: DISPLAY_TZ,
    weekday: "short",
    day: "numeric",
  });
  const parts = fmt.formatToParts(date);
  const wd = parts.find((p) => p.type === "weekday")?.value;
  const dayNum = Number(parts.find((p) => p.type === "day")?.value);
  const map: Record<string, SpecialistCalendarDay["weekdayKey"]> = {
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

function availabilityFromSlotGroups(
  slotGroups: SpecialistsGetByIdResponse["slotGroups"],
  now: Date,
): Pick<
  SpecialistProfileData,
  "calendarDays" | "timeSlotsByDay" | "slotDayKeys"
> {
  const list = slotGroups ?? [];
  const calendarDays: SpecialistCalendarDay[] = [];
  const timeSlotsByDay: string[][] = [];
  const slotDayKeys: Array<"today" | "tomorrow"> = [];

  const sorted = [...list].sort((a, b) => {
    if (a.dayKey === "today" && b.dayKey === "tomorrow") return -1;
    if (a.dayKey === "tomorrow" && b.dayKey === "today") return 1;
    return 0;
  });

  for (const g of sorted) {
    slotDayKeys.push(g.dayKey === "tomorrow" ? "tomorrow" : "today");
    const dateRef =
      g.dayKey === "today" ? now : addCalendarDaysVn(now, 1);
    calendarDays.push(vnCalendarDay(dateRef));
    const uniq = [...new Set(g.times ?? [])].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
    timeSlotsByDay.push(uniq);
  }

  return { calendarDays, timeSlotsByDay, slotDayKeys };
}

export function specialistProfileFromApiDetail(
  detail: SpecialistsGetByIdResponse,
): SpecialistProfileData {
  const card = specialistCardSeedFromApi(
    detail as Parameters<typeof specialistCardSeedFromApi>[0],
  );
  const { calendarDays, timeSlotsByDay, slotDayKeys } =
    availabilityFromSlotGroups(detail.slotGroups, new Date());

  return {
    id: detail.id,
    name: detail.name,
    imageSrc: card.imageSrc,
    imageAlt: detail.name,
    rating: detail.rating,
    lat: card.lat,
    lng: card.lng,
    servicesLine: detail.servicesLine ?? "",
    experienceYears: detail.experienceYears ?? 0,
    clientsLabel: "—",
    reviewsCount: detail.reviewsCount,
    calendarDays,
    timeSlotsByDay,
    slotDayKeys,
    services: bookableServicesFromApi(detail),
  };
}
