/** Диапазон опыта на форме профиля специалиста (онбординг и кабинет). */
export type ExperienceKey = "0-1" | "1-3" | "3-5" | "5+";

export const EXP_ORDER: readonly ExperienceKey[] = ["0-1", "1-3", "3-5", "5+"];

export function yearsToKey(y: number | null | undefined): ExperienceKey | null {
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

export function keyToYears(k: ExperienceKey): number {
  if (k === "0-1") {
    return 0;
  }
  if (k === "1-3") {
    return 2;
  }
  if (k === "3-5") {
    return 4;
  }
  return 6;
}
