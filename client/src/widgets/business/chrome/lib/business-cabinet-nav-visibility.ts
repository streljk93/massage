/** Пункты бокового меню, скрытые до готовности раздела (MVP). */
export const BUSINESS_CABINET_HIDDEN_NAV_IDS = new Set<string>([
  "dashboard",
  "jobSearch",
  "hiring",
  "finance",
  "reviews",
  "marketing",
  "analytics",
]);

export function isBusinessCabinetNavItemVisible(navId: string): boolean {
  return !BUSINESS_CABINET_HIDDEN_NAV_IDS.has(navId);
}

/** Поиск и приглашение существующих специалистов на странице «Моя команда». */
export const BUSINESS_CABINET_SHOW_TEAM_SPECIALIST_INVITE_SEARCH = false;
