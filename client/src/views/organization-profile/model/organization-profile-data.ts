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
  addressLine: string;
  yearsInBusiness: number;
  specialistsCount: number;
  calendarDays: DirectoryCalendarDay[];
  timeSlotsByDay: string[][];
  slotCalendarDates: string[];
  specialists: SalonSpecialistPick[];
};
