import {
  topSalons,
  topSpecialists,
} from "@/widgets/home/lib/mock-data";
import type { BookableServiceOption } from "@/entities/services";
import type { SalonSpecialistPick } from "@/entities/specialists";

type CalendarDay = {
  weekdayKey: "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
  dayOfMonth: number;
};

export type OrganizationProfileData = {
  id: string;
  name: string;
  imageSrc: string;
  imageAlt: string;
  rating: number;
  lat: number;
  lng: number;
  reviewsCount: number;
  addressLine: string;
  yearsInBusiness: number;
  specialistsCount: number;
  calendarDays: CalendarDay[];
  timeSlots: string[];
  services: BookableServiceOption[];
  specialists: SalonSpecialistPick[];
};

function salonSpecialistsFromIds(
  ids: readonly string[],
): SalonSpecialistPick[] {
  return ids.flatMap((sid) => {
    const s = topSpecialists.find((x) => x.id === sid);
    if (!s) return [];
    return [
      {
        specialistId: s.id,
        name: s.name,
        imageSrc: s.imageSrc,
        imageAlt: s.name,
        rating: s.rating,
        metaLine: s.metaLine,
        bookableServices: [],
      },
    ];
  });
}

const extraById: Record<
  string,
  Omit<
    OrganizationProfileData,
    | "id"
    | "name"
    | "imageSrc"
    | "imageAlt"
    | "rating"
    | "lat"
    | "lng"
    | "specialists"
  > & { specialistIds: readonly string[] }
> = {
  s1: {
    addressLine: "Nguyễn Văn A, 125 Lê Lợi",
    reviewsCount: 500,
    yearsInBusiness: 6,
    specialistsCount: 15,
    specialistIds: ["p1", "p2", "p3", "p4", "p5", "p6"],
    calendarDays: [
      { weekdayKey: "sun", dayOfMonth: 21 },
      { weekdayKey: "mon", dayOfMonth: 22 },
      { weekdayKey: "tue", dayOfMonth: 23 },
      { weekdayKey: "wed", dayOfMonth: 24 },
      { weekdayKey: "thu", dayOfMonth: 25 },
      { weekdayKey: "fri", dayOfMonth: 26 },
      { weekdayKey: "sat", dayOfMonth: 27 },
    ],
    timeSlots: ["10:00", "11:00", "12:00", "13:00"],
    services: [
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
      {
        id: "svc-3",
        title: "Relax massage",
        durationMinutes: [60, 90, 120],
        priceVndByDuration: [550_000, 780_000, 990_000],
      },
    ],
  },
  s2: {
    addressLine: "Trần Hưng Đảo, Dương Đông, Phú Quốc",
    reviewsCount: 612,
    yearsInBusiness: 9,
    specialistsCount: 18,
    specialistIds: ["p2", "p4", "p1", "p3", "p6"],
    calendarDays: [
      { weekdayKey: "sun", dayOfMonth: 21 },
      { weekdayKey: "mon", dayOfMonth: 22 },
      { weekdayKey: "tue", dayOfMonth: 23 },
      { weekdayKey: "wed", dayOfMonth: 24 },
      { weekdayKey: "thu", dayOfMonth: 25 },
      { weekdayKey: "fri", dayOfMonth: 26 },
      { weekdayKey: "sat", dayOfMonth: 27 },
    ],
    timeSlots: ["09:00", "10:30", "12:00", "15:00"],
    services: [
      {
        id: "svc-1",
        title: "Relax massage",
        durationMinutes: [60, 90, 120],
        priceVndByDuration: [490_000, 690_000, 880_000],
      },
      {
        id: "svc-2",
        title: "Foot massage",
        durationMinutes: [60, 90],
        priceVndByDuration: [280_000, 390_000],
      },
    ],
  },
};

export function getOrganizationProfile(
  id: string,
): OrganizationProfileData | null {
  const base = topSalons.find((s) => s.id === id);
  const extra = extraById[id];
  if (!base || !extra) return null;

  const { specialistIds, ...rest } = extra;

  return {
    id: base.id,
    name: base.name,
    imageSrc: base.imageSrc,
    imageAlt: base.name,
    rating: base.rating,
    lat: base.lat,
    lng: base.lng,
    specialists: salonSpecialistsFromIds(specialistIds),
    ...rest,
  };
}
