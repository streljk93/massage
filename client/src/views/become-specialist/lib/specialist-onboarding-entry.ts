/** Точка входа в мастер-онбординг (редирект на актуальный шаг). */
export const SPECIALIST_ONBOARDING_ENTRY_PATH = "/business/setup";

export function specialistOnboardingCtaHref(isAuthed: boolean): string {
  if (isAuthed) {
    return SPECIALIST_ONBOARDING_ENTRY_PATH;
  }
  return `/login?next=${encodeURIComponent(SPECIALIST_ONBOARDING_ENTRY_PATH)}`;
}
