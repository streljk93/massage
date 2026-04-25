/**
 * Схема JSON в `UserPreferenceProfile.profile` при `version === 1`.
 * Расширения — bump `version` и ветвление в application-слое.
 */
export const PREFERENCE_PROFILE_JSON_VERSION = 1 as const;

export type PreferenceProfileV1 = {
  version: typeof PREFERENCE_PROFILE_JSON_VERSION;
  /** Подкатегории каталога (slug), от большего веса к меньшему. */
  categorySlugs: string[];
  /** Slug `MajorServiceCategory` для выдачи, если задан. */
  majorSlug: string | null;
  /** Из последнего события с гео (поиск), WGS-84. */
  lastGeo: { lat: number; lng: number } | null;
  /**
   * Диапазон цен из последнего `search_apply_filters` с `metadata` (VND, как в URL поиска).
   * `null` — фильтр по цене не задан. Организации в каталоге по цене не фильтруются, только мастера.
   */
  priceMinVnd: number | null;
  priceMaxVnd: number | null;
};
