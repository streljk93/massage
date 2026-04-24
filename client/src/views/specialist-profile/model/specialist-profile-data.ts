import type { BookableServiceOption } from "@/entities/services";

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
  lat: number;
  lng: number;
  /** Склейка услуг/форматов с витрины (как на карточке в поиске). */
  servicesLine: string;
  experienceYears: number;
  /** Уникальные клиенты с бронью в статусе `done` (см. API `doneClientsCount`). */
  doneClientsCount: number;
  reviewsCount: number;
  calendarDays: SpecialistCalendarDay[];
  /** Свободные слоты по дням (индекс совпадает с `calendarDays`). */
  timeSlotsByDay: string[][];
  /** yyyy-MM-dd витрины по каждому дню (индекс = `calendarDays`). */
  slotCalendarDates: string[];
  services: BookableServiceOption[];
};
