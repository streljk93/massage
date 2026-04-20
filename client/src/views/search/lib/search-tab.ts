export type SearchTab = "organizations" | "specialists";

/** Ключи переводов в namespace `search` для подписей табов. */
export type SearchTabLabelKey = "tabSalons" | "tabSpecialists";

export type SearchTabItem = {
  id: SearchTab;
  labelKey: SearchTabLabelKey;
};

/** Табы списка поиска: список и карта должны использовать одну конфигурацию. */
export const SEARCH_TABS: readonly SearchTabItem[] = [
  { id: "organizations", labelKey: "tabSalons" },
  { id: "specialists", labelKey: "tabSpecialists" },
];

export function parseSearchTab(raw: string | null): SearchTab {
  if (raw === "specialists") return "specialists";
  return "organizations";
}

export function searchTabQueryValue(id: SearchTab) {
  return id === "specialists" ? "specialists" : "organizations";
}
