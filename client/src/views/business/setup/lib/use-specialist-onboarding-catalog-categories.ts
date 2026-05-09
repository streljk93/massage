"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchPersonalCatalogCategoriesForCabinet,
  resolvePersonalCatalogQueryFromSpec,
} from "./personal-catalog-categories-core";
import { useSpecialistOnboarding } from "../ui/specialist-onboarding-context";

export type {
  CatalogCategoryWithMajor,
  SpecialistOnboardingCatalogCategoriesData,
} from "./personal-catalog-categories-core";

export function specialistOnboardingCatalogQueryKey(
  locale: string,
  cacheKey: string,
) {
  return ["specialistOnboardingCatalog", cacheKey, locale] as const;
}

/**
 * Каталог рубрик для онбординга (шаг навыков: подкатегории без прайса) и личных услуг в ЛК.
 * Возвращает сферы и подкатегории с `majorSlug` — UI группирует по сфере.
 */
export function useSpecialistOnboardingCatalogCategories(enabled: boolean) {
  const { sdk, locale, accessToken, ready, spec } = useSpecialistOnboarding();

  const resolved = resolvePersonalCatalogQueryFromSpec(spec ?? undefined);

  return useQuery({
    queryKey: specialistOnboardingCatalogQueryKey(
      locale,
      resolved.cacheKeySuffix,
    ),
    enabled: enabled && ready && accessToken.length > 0,
    queryFn: () =>
      fetchPersonalCatalogCategoriesForCabinet(sdk, locale, resolved),
  });
}
