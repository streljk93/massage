/**
 * Продуктовый порядок онбординга (ADR marketplace). Числовые шаги API см. SpecialistOnboardingService.
 * Принцип: major → навыки (подкатегории, без прайса) → место приёма → финал; прайс/офферы — в кабинете.
 */
export const SpecialistOnboardingStepOrderDocs = Object.freeze([
  'identity_and_role',
  'work_pattern',
  'major_verticals',
  'capabilities_skills_not_pricing',
  'workplace_and_location',
  'offerings_catalog',
] as const);
