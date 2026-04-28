/**
 * Когда специалист отображается в клиентской витрине/поиске.
 * Не путать с ролью в организации.
 */
export function computeListedInDirectory(input: {
  onboardingCompletedAt: Date | null;
  activeOrganizationId: string | null;
}): boolean {
  return (
    input.onboardingCompletedAt != null && input.activeOrganizationId != null
  );
}
