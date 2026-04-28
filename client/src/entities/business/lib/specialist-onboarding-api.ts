import type { UsersGetSpecialistOnboardingResponse } from "@/shared/api/generated/sdk/types.gen";

/**
 * Состояние онбординга с сервера (`GET /users/me/specialist/onboarding`).
 * Шаг 6 — сценарий завершён, кабинет бизнеса открыт.
 */
export function isSpecialistOnboardingComplete(
  data: UsersGetSpecialistOnboardingResponse | null | undefined,
): boolean {
  return data?.onboardingStep === 6;
}

/**
 * Какой UI-шаг визарда открывать по умолчанию, если в URL нет `?step=`
 * (серверный шаг из `GET /users/me/specialist/onboarding`).
 */
export function defaultWizardStepForApiStep(apiStep: number): number {
  switch (apiStep) {
    case 1:
      return 1;
    case 3:
      return 3;
    case 4:
      return 4;
    case 5:
    case 6:
      return 5;
    default:
      return 1;
  }
}

/** Макс. «вперёд» по UI-шагам 1…5, исходя из серверного шага. */
export function maxUiStepAllowed(apiStep: 1 | 3 | 4 | 5 | 6): number {
  switch (apiStep) {
    case 1:
      return 2;
    case 3:
      return 3;
    case 4:
      return 4;
    case 5:
    case 6:
      return 5;
    default:
      return 2;
  }
}
