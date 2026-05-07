"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AppLocale } from "@/app/i18n/routing";
import type { Client } from "@/shared/api/generated/sdk/client";
import { catalogGetBulkCategoriesByMajorSlugs } from "@/shared/api";

export type OrganizationCabinetCatalogSection = {
  majorSlug: string;
  majorName: string;
  categories: Array<{ id: string; label: string; slug: string }>;
};

function majorSlugsQueryParam(slugs: string[]): string {
  return [...new Set(slugs.map((s) => s.trim()).filter((s) => s.length > 0))]
    .sort()
    .join(",");
}

export function organizationCabinetMergedCatalogQueryKey(
  locale: string,
  majorSlugsParam: string,
  accessToken: string,
  listedInDirectory: boolean,
) {
  return [
    "organizationCabinetMergedCatalog",
    locale,
    majorSlugsParam,
    listedInDirectory,
    accessToken,
  ] as const;
}

/**
 * Подкатегории для формы кабинета организации: union по нескольким major (primary + дополнительные).
 */
export function useOrganizationCabinetMergedCatalogCategories(opts: {
  client: Client;
  locale: AppLocale;
  majorSlugs: string[];
  enabled: boolean;
  accessToken: string;
  /** Для кабинета — все активные подкатегории по мжорам; `true` только если нужен срез как у публичного поиска. */
  listedInDirectory?: boolean;
}) {
  const listed = opts.listedInDirectory ?? false;
  const majorSlugsParam = useMemo(
    () => majorSlugsQueryParam(opts.majorSlugs),
    [opts.majorSlugs],
  );

  return useQuery({
    queryKey: organizationCabinetMergedCatalogQueryKey(
      opts.locale,
      majorSlugsParam,
      opts.accessToken,
      listed,
    ),
    enabled:
      opts.enabled &&
      opts.accessToken.length > 0 &&
      majorSlugsParam.length > 0,
    queryFn: async (): Promise<{
      sections: OrganizationCabinetCatalogSection[];
      allCategoryIds: string[];
    }> => {
      const { data, error } = await catalogGetBulkCategoriesByMajorSlugs({
        client: opts.client,
        query: {
          locale: opts.locale,
          listedInDirectory: listed,
          majorSlugs: majorSlugsParam,
        },
      });
      if (error || !data?.sections?.length) {
        throw new Error("organizationCabinetMergedCatalog");
      }
      const sections: OrganizationCabinetCatalogSection[] = data.sections.map(
        (sec) => ({
          majorSlug: sec.majorCategory.slug,
          majorName: sec.majorCategory.name,
          categories: sec.categories.map((c) => ({
            id: c.id,
            slug: c.slug,
            label: c.shortName,
          })),
        }),
      );
      const allCategoryIds = sections.flatMap((s) => s.categories.map((c) => c.id));
      return { sections, allCategoryIds };
    },
  });
}
