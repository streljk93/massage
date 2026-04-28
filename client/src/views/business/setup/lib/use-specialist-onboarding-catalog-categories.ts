"use client";

import { useQuery } from "@tanstack/react-query";
import { catalogGetCategoriesByMajorSlug } from "@/shared/api";
import { CATALOG_MAJOR_CATEGORY_SLUG } from "@/shared/config/catalog-major-category";
import type { Cat } from "./specialist-onboarding-utils";
import { useSpecialistOnboarding } from "../ui/specialist-onboarding-context";

export function specialistOnboardingCatalogQueryKey(locale: string) {
  return [
    "specialistOnboardingCatalog",
    CATALOG_MAJOR_CATEGORY_SLUG,
    locale,
  ] as const;
}

/**
 * Каталог рубрик для онбординга (услуги / форма салона).
 * Включайте только на шагах, где список реально нужен — React Query дедуплицирует по ключу.
 */
export function useSpecialistOnboardingCatalogCategories(enabled: boolean) {
  const { sdk, locale, accessToken, ready } = useSpecialistOnboarding();

  return useQuery({
    queryKey: specialistOnboardingCatalogQueryKey(locale),
    enabled: enabled && ready && accessToken.length > 0,
    queryFn: async (): Promise<Cat[]> => {
      const { data, error } = await catalogGetCategoriesByMajorSlug({
        client: sdk,
        path: { majorSlug: CATALOG_MAJOR_CATEGORY_SLUG },
        query: { locale, listedInDirectory: true },
      });
      if (error || !data?.categories?.length) {
        throw new Error("onboarding catalog");
      }
      return data.categories.map((x) => ({
        id: x.id,
        slug: x.slug,
        label: x.shortName,
      }));
    },
  });
}
