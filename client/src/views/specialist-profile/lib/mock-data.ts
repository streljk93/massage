import { topSpecialists } from "@/widgets/home/lib/mock-data";

export type SpecialistServiceOption = {
  id: string;
  /** Ключ в `specialistProfile.services.*` */
  nameKey: "footMassage" | "relaxMassage";
  priceVnd: number;
  durationMinutes: readonly number[];
};

export type SpecialistCalendarDay = {
  weekdayKey: "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
  dayOfMonth: number;
};

export type SpecialistProfileData = {
  id: string;
  name: string;
  imageSrc: string;
  imageAlt: string;
  rating: number;
  /** Точка на карте (остров Phú Quốc, демо). */
  lat: number;
  lng: number;
  specialtiesLine: string;
  experienceYears: number;
  clientsLabel: string;
  reviewsCount: number;
  calendarDays: SpecialistCalendarDay[];
  timeSlots: string[];
  services: SpecialistServiceOption[];
};

const extraById: Record<
  string,
  Omit<
    SpecialistProfileData,
    "id" | "name" | "imageSrc" | "imageAlt" | "rating" | "lat" | "lng"
  >
> = {
  p1: {
    specialtiesLine: "foots, hands, back, neck, after sport, relax,",
    experienceYears: 8,
    clientsLabel: "1.5k +",
    reviewsCount: 500,
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
        nameKey: "footMassage",
        priceVnd: 320_000,
        durationMinutes: [60, 90, 120],
      },
      {
        id: "svc-2",
        nameKey: "relaxMassage",
        priceVnd: 550_000,
        durationMinutes: [60, 90, 120],
      },
      {
        id: "svc-3",
        nameKey: "relaxMassage",
        priceVnd: 550_000,
        durationMinutes: [60, 90, 120],
      },
    ],
  },
  p2: {
    specialtiesLine: "Thai, Swedish, reflexology, sports recovery,",
    experienceYears: 5,
    clientsLabel: "980 +",
    reviewsCount: 210,
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
        nameKey: "relaxMassage",
        priceVnd: 480_000,
        durationMinutes: [60, 90, 120],
      },
      {
        id: "svc-2",
        nameKey: "footMassage",
        priceVnd: 290_000,
        durationMinutes: [60, 90],
      },
    ],
  },
};

export function getSpecialistProfile(
  id: string,
): SpecialistProfileData | null {
  const base = topSpecialists.find((s) => s.id === id);
  const extra = extraById[id];
  if (!base || !extra) return null;

  return {
    id: base.id,
    name: base.name,
    imageSrc: base.imageSrc,
    imageAlt: base.name,
    rating: base.rating,
    ...extra,
    lat: base.lat,
    lng: base.lng,
  };
}
