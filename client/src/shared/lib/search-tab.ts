export type SearchTab = "organizations" | "specialists";

/** Ключи переводов в namespace `search` для подписей табов. */
export type SearchTabLabelKey = "tabSalons" | "tabSpecialists";

export type SearchTabItem = {
  id: SearchTab;
  labelKey: SearchTabLabelKey;
};

/** Табы списка поиска: список и карта должны использовать одну конфигурацию. Приоритет — специалисты. */
export const SEARCH_TABS: readonly SearchTabItem[] = [
  { id: "specialists", labelKey: "tabSpecialists" },
  { id: "organizations", labelKey: "tabSalons" },
];

/** Без `?tab=` по умолчанию открываем специалистов. Явно `?tab=organizations` — салоны. */
export function parseSearchTab(raw: string | null): SearchTab {
  if (raw === "organizations") return "organizations";
  return "specialists";
}

export function searchTabQueryValue(id: SearchTab) {
  return id === "specialists" ? "specialists" : "organizations";
}
