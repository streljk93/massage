"use client";

import { useQuery } from "@tanstack/react-query";
import {
  catalogGetBulkCategoriesByMajorSlugs,
  catalogGetCategoriesByMajorSlug,
} from "@/shared/api";
import { CATALOG_MAJOR_CATEGORY_SLUG } from "@/shared/config/catalog-major-category";
import type { Cat } from "./specialist-onboarding-utils";
import { useSpecialistOnboarding } from "../ui/specialist-onboarding-context";

export function specialistOnboardingCatalogQueryKey(
  locale: string,
  cacheKey: string,
) {
  return ["specialistOnboardingCatalog", cacheKey, locale] as const;
}

/** Категории с привязкой к большой категории — для фильтра по вкладке на шаге услуг. */
export type CatalogCategoryWithMajor = Cat & { majorSlug: string };

export type SpecialistOnboardingCatalogCategoriesData = {
  /** Порядок совпадает с запросом bulk (после `normalizeMajorSlugs`). */
  majors: Array<{ slug: string; name: string }>;
  categories: CatalogCategoryWithMajor[];
};

function normalizeMajorSlugs(
  arr: string[] | null | undefined,
): string[] {
  return [
    ...new Set(
      (arr ?? [])
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0),
    ),
  ].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function buildFromBulkSections(
  sections: Array<{
    majorCategory: { slug: string; name: string };
    categories: Array<{
      id: string;
      slug: string;
      name: string;
      shortName: string;
      description: string | null;
    }>;
  }>,
): SpecialistOnboardingCatalogCategoriesData {
  const majors: Array<{ slug: string; name: string }> = [];
  const categories: CatalogCategoryWithMajor[] = [];
  for (const sec of sections) {
    const slug = sec.majorCategory.slug;
    majors.push({ slug, name: sec.majorCategory.name });
    for (const c of sec.categories) {
      categories.push({
        id: c.id,
        slug: c.slug,
        name: c.name,
        shortName: c.shortName,
        description: c.description,
        label: c.name,
        majorSlug: slug,
      });
    }
  }
  return { majors, categories };
}

/**
 * Каталог рубрик для онбординга (шаг личных услуг).
 * Возвращает сферы и подкатегории с `majorSlug` — UI выбирает сферу и показывает только её рубрики.
 */
export function useSpecialistOnboardingCatalogCategories(enabled: boolean) {
  const { sdk, locale, accessToken, ready, spec } = useSpecialistOnboarding();

  const activeOrgId = spec?.activeOrganizationId ?? null;
  const workplaceSlugs = spec?.activeWorkplaceMajorCategorySlugs;
  const onboardingMajorSlugs = spec?.onboardingMajorCategorySlugs;

  const workplaceMajorsEmpty =
    activeOrgId != null &&
    activeOrgId !== "" &&
    workplaceSlugs != null &&
    workplaceSlugs.length === 0;

  const defaultCacheKey = `single:${CATALOG_MAJOR_CATEGORY_SLUG}`;

  const orgMajorSlugs =
    workplaceMajorsEmpty ? []
    : activeOrgId != null &&
        activeOrgId !== "" &&
        workplaceSlugs != null &&
        workplaceSlugs.length > 0 ?
      normalizeMajorSlugs(workplaceSlugs)
    : [];

  const onboardingSlugList = normalizeMajorSlugs(onboardingMajorSlugs);

  const bulkSlugSource =
    workplaceMajorsEmpty ? null
    : orgMajorSlugs.length > 0 || onboardingSlugList.length > 0 ?
      normalizeMajorSlugs([...orgMajorSlugs, ...onboardingSlugList])
    : null;

  const bulkParam =
    bulkSlugSource != null && bulkSlugSource.length > 0 ?
      bulkSlugSource.join(",")
    : "";

  const cacheKey =
    workplaceMajorsEmpty ? "workplace-majors-empty"
    : bulkParam.length > 0 ? `bulk:${bulkParam}`
    : defaultCacheKey;

  return useQuery({
    queryKey: specialistOnboardingCatalogQueryKey(locale, cacheKey),
    enabled: enabled && ready && accessToken.length > 0,
    queryFn: async (): Promise<SpecialistOnboardingCatalogCategoriesData> => {
      if (workplaceMajorsEmpty) {
        return { majors: [], categories: [] };
      }
      if (bulkParam.length > 0) {
        const { data, error } = await catalogGetBulkCategoriesByMajorSlugs({
          client: sdk,
          query: { locale, majorSlugs: bulkParam },
        });
        if (error || !data?.sections?.length) {
          throw new Error("onboarding catalog bulk");
        }
        return buildFromBulkSections(data.sections);
      }
      const { data, error } = await catalogGetCategoriesByMajorSlug({
        client: sdk,
        path: { majorSlug: CATALOG_MAJOR_CATEGORY_SLUG },
        query: { locale },
      });
      if (error || !data?.categories?.length) {
        throw new Error("onboarding catalog");
      }
      const ms = data.majorCategory.slug;
      return {
        majors: [{ slug: ms, name: data.majorCategory.name }],
        categories: data.categories.map((x) => ({
          id: x.id,
          slug: x.slug,
          name: x.name,
          shortName: x.shortName,
          description: x.description,
          label: x.name,
          majorSlug: ms,
        })),
      };
    },
  });
}
