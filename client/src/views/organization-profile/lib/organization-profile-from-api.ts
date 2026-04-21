import type { BookableServiceOption } from "@/entities/services";
import type { SalonSpecialistPick } from "@/entities/specialists";
import type { OrganizationsGetByIdResponse } from "@/shared/api";
import { resolveDirectoryImageSrc } from "@/widgets/home/lib/directory-cards-from-api";
import type { OrganizationProfileData } from "./mock-data";

/** Пока нет каталога услуг по API — демо-набор для экрана бронирования. */
const DEFAULT_ORG_SERVICES: BookableServiceOption[] = [
  {
    id: "svc-1",
    title: "Foot massage",
    durationMinutes: [60, 90, 120],
    priceVndByDuration: [320_000, 450_000, 580_000],
  },
  {
    id: "svc-2",
    title: "Relax massage",
    durationMinutes: [60, 90, 120],
    priceVndByDuration: [550_000, 780_000, 990_000],
  },
];

const DEFAULT_CALENDAR_DAYS: OrganizationProfileData["calendarDays"] = [
  { weekdayKey: "sun", dayOfMonth: 21 },
  { weekdayKey: "mon", dayOfMonth: 22 },
  { weekdayKey: "tue", dayOfMonth: 23 },
  { weekdayKey: "wed", dayOfMonth: 24 },
  { weekdayKey: "thu", dayOfMonth: 25 },
  { weekdayKey: "fri", dayOfMonth: 26 },
  { weekdayKey: "sat", dayOfMonth: 27 },
];

const DEFAULT_TIME_SLOTS = ["10:00", "11:00", "12:00", "13:00"];

export function organizationProfileFromApiDetail(
  detail: OrganizationsGetByIdResponse,
): OrganizationProfileData {
  const imageSrc = resolveDirectoryImageSrc(detail.imageUrl);
  const lat = detail.latitude ?? 0;
  const lng = detail.longitude ?? 0;
  const addressLine =
    [detail.addressLine, detail.city].filter(Boolean).join(", ") ||
    detail.metaLine;

  const specialists: SalonSpecialistPick[] = detail.staff.map((s) => ({
    specialistId: s.id,
    name: s.name,
    imageSrc: resolveDirectoryImageSrc(s.imageUrl),
    imageAlt: s.name,
    rating: s.rating,
    metaLine: s.metaLine,
    bookableServices: (s.bookableServices ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      durationMinutes: b.durationMinutes as readonly number[],
      priceVndByDuration: b.priceVndByDuration as readonly number[],
    })),
  }));

  return {
    id: detail.id,
    name: detail.name,
    imageSrc,
    imageAlt: detail.name,
    rating: detail.rating,
    lat,
    lng,
    reviewsCount: detail.reviewsCount,
    addressLine,
    yearsInBusiness: detail.yearsInBusiness ?? 0,
    specialistsCount: specialists.length,
    calendarDays: DEFAULT_CALENDAR_DAYS,
    timeSlots: DEFAULT_TIME_SLOTS,
    services: DEFAULT_ORG_SERVICES,
    specialists,
  };
}
