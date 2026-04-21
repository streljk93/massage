import type { BookableServiceOption } from "@/entities/services";
import type { SpecialistsGetByIdResponse } from "@/shared/api";
import { specialistCardSeedFromApi } from "@/widgets/home/lib/directory-cards-from-api";
import type { SpecialistProfileData } from "./mock-data";

const DEFAULT_CALENDAR_DAYS: SpecialistProfileData["calendarDays"] = [
  { weekdayKey: "sun", dayOfMonth: 21 },
  { weekdayKey: "mon", dayOfMonth: 22 },
  { weekdayKey: "tue", dayOfMonth: 23 },
  { weekdayKey: "wed", dayOfMonth: 24 },
  { weekdayKey: "thu", dayOfMonth: 25 },
  { weekdayKey: "fri", dayOfMonth: 26 },
  { weekdayKey: "sat", dayOfMonth: 27 },
];

const DEFAULT_TIME_SLOTS = ["10:00", "11:00", "12:00", "13:00"];

const DEFAULT_SERVICES: BookableServiceOption[] = [
  {
    id: "svc-1",
    nameKey: "footMassage",
    durationMinutes: [60, 90, 120],
    priceVndByDuration: [320_000, 450_000, 580_000],
  },
  {
    id: "svc-2",
    nameKey: "relaxMassage",
    durationMinutes: [60, 90, 120],
    priceVndByDuration: [550_000, 780_000, 990_000],
  },
];

export function specialistProfileFromApiDetail(
  detail: SpecialistsGetByIdResponse,
): SpecialistProfileData {
  const card = specialistCardSeedFromApi(
    detail as Parameters<typeof specialistCardSeedFromApi>[0],
  );
  return {
    id: detail.id,
    name: detail.name,
    imageSrc: card.imageSrc,
    imageAlt: detail.name,
    rating: detail.rating,
    lat: card.lat,
    lng: card.lng,
    specialtiesLine: detail.specialtiesLine ?? "",
    experienceYears: detail.experienceYears ?? 0,
    clientsLabel: "—",
    reviewsCount: detail.reviewsCount,
    calendarDays: DEFAULT_CALENDAR_DAYS,
    timeSlots: DEFAULT_TIME_SLOTS,
    services: DEFAULT_SERVICES,
  };
}
