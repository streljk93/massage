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
  /** Фото витрины (порядок как в API). Пусто — в шапке только обложка `imageSrc`. */
  vitrineGallery: { src: string; alt: string }[];
  /** Только для владельца до публикации во витрине. */
  publicationModerationStatus?: "approved" | "pending_review" | "rejected";
};
