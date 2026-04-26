import type { SalonSpecialistPick } from "@/entities/specialists";
import type { DirectoryCalendarDay } from "@/shared/lib/directory-slot-calendar";

export type OrganizationProfileData = {
  id: string;
  name: string;
  imageSrc: string;
  imageAlt: string;
  rating: number;
  lat: number;
  lng: number;
  reviewsCount: number;
  phone: string | null;
  addressLine: string;
  yearsInBusiness: number;
  /** Уникальные клиенты с бронью в `done` (см. API `clientsCount`). */
  clientsCount: number;
  calendarDays: DirectoryCalendarDay[];
  timeSlotsByDay: string[][];
  slotCalendarDates: string[];
  specialists: SalonSpecialistPick[];
};
