import type { SpecialistsCabinetGetSpecialistCabinetProfileResponse } from "@/shared/api";

/** Объект `specialist` из кабинетного профиля / applicant cabinet-profile (одинаковая форма на бэкенде). */
export type CabinetSpecialistBlob = NonNullable<
  SpecialistsCabinetGetSpecialistCabinetProfileResponse["specialist"]
>;
