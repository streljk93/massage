import type { SpecialistsCabinetGetSpecialistOnboardingResponse } from "@/shared/api/generated/sdk/types.gen";

/**
 * Серверный шаг `onboardingStep` из `GET /specialists/me/onboarding` → локальный номер страницы
 * `/business/setup/:step` (1…8).
 */
export function onboardingApiStepToUiStep(apiStep: number): number {
  switch (apiStep) {
    case 1:
      return 1;
    case 2:
      return 2;
    case 3:
      return 3;
    case 4:
      return 4;
    case 5:
      return 5;
    case 11:
      return 6;
    case 12:
      return 7;
    case 13:
      return 8;
    case 6:
      return 8;
    default:
      return 1;
  }
}

/**
 * Состояние онбординга с сервера (`GET /specialists/me/onboarding`).
 * Шаг 6 API — кабинет разблокирован.
 */
export function isSpecialistOnboardingComplete(
  data: SpecialistsCabinetGetSpecialistOnboardingResponse | null | undefined,
): boolean {
  return data?.onboardingStep === 6;
}

/** У пользователя уже создан профиль специалиста (`onboardingStep` ушёл дальше шага создания). */
export function hasSpecialistAccount(
  data: SpecialistsCabinetGetSpecialistOnboardingResponse | null | undefined,
): boolean {
  return data != null && data.onboardingStep !== 1;
}

/**
 * Какой UI-шаг по умолчанию открыть по серверному `onboardingStep`.
 */
export function defaultWizardStepForApiStep(apiStep: number): number {
  return onboardingApiStepToUiStep(apiStep);
}

/** Допустимый максимальный UI-шаг (ниже нельзя уводить пользователя глубже, чем разрешено API). */
export function maxUiStepAllowed(apiStep: number): number {
  if (apiStep === 6) {
    return 8;
  }
  return onboardingApiStepToUiStep(apiStep);
}
