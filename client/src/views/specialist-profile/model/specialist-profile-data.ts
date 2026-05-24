import type { BookableServiceOption } from "@/entities/services";

/** Текущий салон приёма (`activeOrganization` в API). */
export type SpecialistActiveWorkplace = {
  id: string;
  name: string;
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
  lat: number;
  lng: number;
  /** Склейка услуг/форматов с витрины (как на карточке в поиске). */
  servicesLine: string;
  /** Витринное описание мастера. */
  bio: string | null;
  /** Адрес активной организации. */
  addressLine: string | null;
  city: string | null;
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
  /** Телефон салона или мастера (см. API). */
  phone: string | null;
  /** Активная организация для приёма; `null`, если не выбрана. */
  activeWorkplace: SpecialistActiveWorkplace | null;
  /** Для самого мастера: модерация текущего салона во витрине. */
  workplacePublicationModerationStatus?: "approved" | "pending_review" | "rejected";
};
