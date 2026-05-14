/**
 * Когда специалист отображается в клиентской витрине/поиске.
 * Не путать с ролью в организации.
 */
export function computeListedInDirectory(input: {
  onboardingCompletedAt: Date | null;
  hasActiveWorkplace: boolean;
}): boolean {
  return input.onboardingCompletedAt != null && input.hasActiveWorkplace;
}

/**
 * Read-side helper: наружу видимость специалиста читается только из persisted projection.
 */
export function isSpecialistVisible(input: {
  listedInDirectory: boolean;
}): boolean {
  return input.listedInDirectory;
}
