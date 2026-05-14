"use client";

import { useMemo } from "react";
import type { AppLocale } from "@/app/i18n/routing";
import {
  catalogGetBulkCategoriesByMajorSlugs,
  type createBrowserSdkClient,
} from "@/shared/api";
import { useQuery } from "@tanstack/react-query";

export type BusinessServiceCategoryOption = {
  id: string;
  label: string;
  name: string;
  majorName: string;
};

export function serviceCategoriesQueryKey(
  majorCategorySlugs: readonly string[] | undefined,
  locale: AppLocale,
) {
  return [
    "serviceCategories",
    { majorSlugs: [...(majorCategorySlugs ?? [])].sort(), locale },
  ] as const;
}

export function useServiceCategories({
  sdk,
  locale,
  majorCategorySlugs,
}: {
  sdk: ReturnType<typeof createBrowserSdkClient>;
  locale: AppLocale;
  majorCategorySlugs: readonly string[] | undefined;
}) {
  const majorSlugsCsv = useMemo(
    () =>
      majorCategorySlugs
        ?.filter((slug) => slug.trim().length > 0)
        .join(",")
        .trim() ?? "",
    [majorCategorySlugs],
  );

  return useQuery({
    queryKey: serviceCategoriesQueryKey(majorCategorySlugs, locale),
    enabled: majorSlugsCsv.length > 0,
    queryFn: async () => {
      const { data, error } = await catalogGetBulkCategoriesByMajorSlugs({
        client: sdk,
        query: { majorSlugs: majorSlugsCsv, locale },
      });
      if (error || !data) throw error ?? new Error("catalog");
      const options: BusinessServiceCategoryOption[] = [];
      for (const section of data.sections) {
        for (const category of section.categories) {
          options.push({
            id: category.id,
            label: `${section.majorCategory.name} — ${category.name}`,
            name: category.name,
            majorName: section.majorCategory.name,
          });
        }
      }
      return options;
    },
  });
}
