import type { SpecialistsCabinetGetSpecialistOnboardingResponse } from "@/shared/api";

/** Объект `specialist` из онбординга / applicant cabinet-profile (одинаковая форма на бэкенде). */
export type CabinetSpecialistBlob = NonNullable<
  SpecialistsCabinetGetSpecialistOnboardingResponse["specialist"]
>;
