/**
 * Общая логика набора больших категорий и рубрик для личных услуг мастера
 * (онбординг и экраны ЛК). Должна совпадать с доменными правилами салона vs онбординг.
 */

import type { AppLocale } from "@/app/i18n/routing";
import {
  catalogGetBulkCategoriesByMajorSlugs,
  catalogGetCategoriesByMajorSlug,
  createBrowserSdkClient,
} from "@/shared/api";
import { CATALOG_MAJOR_CATEGORY_SLUG } from "@/shared/config/catalog-major-category";
import type { Cat } from "./specialist-onboarding-utils";

export type CatalogCategoryWithMajor = Cat & { majorSlug: string };

export type SpecialistOnboardingCatalogCategoriesData = {
  majors: Array<{ slug: string; name: string }>;
  categories: CatalogCategoryWithMajor[];
};

/** Поля профиля кабинета, влияющие на набор больших категорий в каталоге услуги. */
export type PersonalCatalogMajorSourceSpec = {
  /** Legacy name in onboarding payload; contains active workplace organization id. */
  activeOrganizationId?: string | null;
  onboardingMajorCategorySlugs?: string[];
  activeWorkplaceMajorCategorySlugs?: string[];
};

export function normalizePersonalCatalogMajorSlugs(
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

function personalCategoriesFromBulkSections(
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

/** Параметры запроса каталога: как у `useSpecialistOnboardingCatalogCategories`. */
export function resolvePersonalCatalogQueryFromSpec(
  spec: PersonalCatalogMajorSourceSpec | null | undefined,
): {
  workplaceMajorsEmpty: boolean;
  bulkParam: string;
  cacheKeySuffix: string;
} {
  const workplaceSlugs = spec?.activeWorkplaceMajorCategorySlugs;
  const onboardingMajorSlugs = spec?.onboardingMajorCategorySlugs;

  const workplaceMajorsEmpty =
    workplaceSlugs != null &&
    workplaceSlugs.length === 0;

  const defaultCacheKey = `single:${CATALOG_MAJOR_CATEGORY_SLUG}`;

  const orgMajorSlugs =
    workplaceMajorsEmpty ? []
    : workplaceSlugs != null &&
        workplaceSlugs.length > 0 ?
      normalizePersonalCatalogMajorSlugs(workplaceSlugs)
    : [];

  const onboardingSlugList = normalizePersonalCatalogMajorSlugs(
    onboardingMajorSlugs,
  );

  const bulkSlugSource =
    workplaceMajorsEmpty ? null
    : orgMajorSlugs.length > 0 || onboardingSlugList.length > 0 ?
      normalizePersonalCatalogMajorSlugs([...orgMajorSlugs, ...onboardingSlugList])
    : null;

  const bulkParam =
    bulkSlugSource != null && bulkSlugSource.length > 0 ?
      bulkSlugSource.join(",")
    : "";

  const cacheKeySuffix =
    workplaceMajorsEmpty ? "workplace-majors-empty"
    : bulkParam.length > 0 ? `bulk:${bulkParam}`
    : defaultCacheKey;

  return { workplaceMajorsEmpty, bulkParam, cacheKeySuffix };
}

type CabinetSdkClient = ReturnType<typeof createBrowserSdkClient>;

export async function fetchPersonalCatalogCategoriesForCabinet(
  sdk: CabinetSdkClient,
  locale: AppLocale,
  resolved: { workplaceMajorsEmpty: boolean; bulkParam: string },
): Promise<SpecialistOnboardingCatalogCategoriesData> {
  if (resolved.workplaceMajorsEmpty) {
    return { majors: [], categories: [] };
  }
  if (resolved.bulkParam.length > 0) {
    const { data, error } = await catalogGetBulkCategoriesByMajorSlugs({
      client: sdk,
      query: { locale, majorSlugs: resolved.bulkParam },
    });
    if (error || !data?.sections?.length) {
      throw new Error("cabinet catalog bulk");
    }
    return personalCategoriesFromBulkSections(data.sections);
  }
  const { data, error } = await catalogGetCategoriesByMajorSlug({
    client: sdk,
    path: { majorSlug: CATALOG_MAJOR_CATEGORY_SLUG },
    query: { locale },
  });
  if (error || !data?.categories?.length) {
    throw new Error("cabinet catalog single major");
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
}
