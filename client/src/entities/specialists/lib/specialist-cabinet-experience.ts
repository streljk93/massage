export type SpecialistCabinetExperienceKey = "0-1" | "1-3" | "3-5" | "5+";

export function specialistCabinetYearsToKey(
  y: number | null | undefined,
): SpecialistCabinetExperienceKey | null {
  if (y == null) {
    return null;
  }
  if (y <= 1) {
    return "0-1";
  }
  if (y <= 3) {
    return "1-3";
  }
  if (y <= 5) {
    return "3-5";
  }
  return "5+";
}

export function specialistCabinetExpTranslationKey(
  k: SpecialistCabinetExperienceKey,
): "exp_0_1" | "exp_1_3" | "exp_3_5" | "exp_5p" {
  if (k === "0-1") {
    return "exp_0_1";
  }
  if (k === "1-3") {
    return "exp_1_3";
  }
  if (k === "3-5") {
    return "exp_3_5";
  }
  return "exp_5p";
}
