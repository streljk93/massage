import type { BookableServiceOption } from "@/entities/services";
import { topSpecialists } from "@/widgets/home/lib/mock-data";

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
  services: BookableServiceOption[];
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
        durationMinutes: [60, 90, 120],
        priceVndByDuration: [320_000, 450_000, 580_000],
      },
      {
        id: "svc-2",
        nameKey: "relaxMassage",
        durationMinutes: [60, 90, 120],
        priceVndByDuration: [550_000, 780_000, 990_000],
      },
      {
        id: "svc-3",
        nameKey: "relaxMassage",
        durationMinutes: [60, 90, 120],
        priceVndByDuration: [550_000, 780_000, 990_000],
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
        durationMinutes: [60, 90, 120],
        priceVndByDuration: [480_000, 670_000, 850_000],
      },
      {
        id: "svc-2",
        nameKey: "footMassage",
        durationMinutes: [60, 90],
        priceVndByDuration: [290_000, 410_000],
      },
    ],
  },
  p3: {
    specialtiesLine: "Deep tissue, sports recovery, stretching, posture,",
    experienceYears: 6,
    clientsLabel: "720 +",
    reviewsCount: 188,
    calendarDays: [
      { weekdayKey: "sun", dayOfMonth: 21 },
      { weekdayKey: "mon", dayOfMonth: 22 },
      { weekdayKey: "tue", dayOfMonth: 23 },
      { weekdayKey: "wed", dayOfMonth: 24 },
      { weekdayKey: "thu", dayOfMonth: 25 },
      { weekdayKey: "fri", dayOfMonth: 26 },
      { weekdayKey: "sat", dayOfMonth: 27 },
    ],
    timeSlots: ["09:00", "11:00", "14:00", "16:00"],
    services: [
      {
        id: "svc-1",
        nameKey: "relaxMassage",
        durationMinutes: [60, 90],
        priceVndByDuration: [520_000, 720_000],
      },
      {
        id: "svc-2",
        nameKey: "footMassage",
        durationMinutes: [60, 90, 120],
        priceVndByDuration: [310_000, 430_000, 540_000],
      },
    ],
  },
  p4: {
    specialtiesLine: "Aroma, hot stone, lymphatic, prenatal (gentle),",
    experienceYears: 4,
    clientsLabel: "640 +",
    reviewsCount: 256,
    calendarDays: [
      { weekdayKey: "sun", dayOfMonth: 21 },
      { weekdayKey: "mon", dayOfMonth: 22 },
      { weekdayKey: "tue", dayOfMonth: 23 },
      { weekdayKey: "wed", dayOfMonth: 24 },
      { weekdayKey: "thu", dayOfMonth: 25 },
      { weekdayKey: "fri", dayOfMonth: 26 },
      { weekdayKey: "sat", dayOfMonth: 27 },
    ],
    timeSlots: ["10:00", "12:00", "15:00"],
    services: [
      {
        id: "svc-1",
        nameKey: "relaxMassage",
        durationMinutes: [60, 90, 120],
        priceVndByDuration: [560_000, 790_000, 990_000],
      },
      {
        id: "svc-2",
        nameKey: "footMassage",
        durationMinutes: [60, 90],
        priceVndByDuration: [300_000, 420_000],
      },
    ],
  },
  p5: {
    specialtiesLine: "Foot reflexology, cupping, combo packages,",
    experienceYears: 10,
    clientsLabel: "2.1k +",
    reviewsCount: 420,
    calendarDays: [
      { weekdayKey: "sun", dayOfMonth: 21 },
      { weekdayKey: "mon", dayOfMonth: 22 },
      { weekdayKey: "tue", dayOfMonth: 23 },
      { weekdayKey: "wed", dayOfMonth: 24 },
      { weekdayKey: "thu", dayOfMonth: 25 },
      { weekdayKey: "fri", dayOfMonth: 26 },
      { weekdayKey: "sat", dayOfMonth: 27 },
    ],
    timeSlots: ["08:30", "11:30", "14:30", "18:00"],
    services: [
      {
        id: "svc-1",
        nameKey: "footMassage",
        durationMinutes: [60, 90, 120],
        priceVndByDuration: [340_000, 470_000, 600_000],
      },
      {
        id: "svc-2",
        nameKey: "relaxMassage",
        durationMinutes: [60, 90],
        priceVndByDuration: [510_000, 700_000],
      },
    ],
  },
  p6: {
    specialtiesLine: "Lymphatic drainage, facial massage, gentle relax,",
    experienceYears: 7,
    clientsLabel: "890 +",
    reviewsCount: 302,
    calendarDays: [
      { weekdayKey: "sun", dayOfMonth: 21 },
      { weekdayKey: "mon", dayOfMonth: 22 },
      { weekdayKey: "tue", dayOfMonth: 23 },
      { weekdayKey: "wed", dayOfMonth: 24 },
      { weekdayKey: "thu", dayOfMonth: 25 },
      { weekdayKey: "fri", dayOfMonth: 26 },
      { weekdayKey: "sat", dayOfMonth: 27 },
    ],
    timeSlots: ["09:30", "11:00", "14:30", "16:30"],
    services: [
      {
        id: "svc-1",
        nameKey: "relaxMassage",
        durationMinutes: [60, 90, 120],
        priceVndByDuration: [530_000, 740_000, 940_000],
      },
      {
        id: "svc-2",
        nameKey: "footMassage",
        durationMinutes: [60, 90],
        priceVndByDuration: [300_000, 420_000],
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
