"use client";

import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AppLocale } from "@/app/i18n/routing";
import {
  catalogGetCategoriesByMajorSlug,
  createBrowserSdkClient,
} from "@/shared/api";
import { CATALOG_MAJOR_CATEGORY_SLUG } from "@/shared/config/catalog-major-category";
import type { Cat } from "@/entities/specialists";

/**
 * Категории услуг для ЛК мастера вне визарда онбординга.
 */
export function useBusinessCabinetCatalogCategories(enabled: boolean) {
  const locale = useLocale() as AppLocale;
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken ?? "";
  const sdk = useMemo(
    () => createBrowserSdkClient(accessToken, { locale }),
    [accessToken, locale],
  );

  const defaultKey = `single:${CATALOG_MAJOR_CATEGORY_SLUG}`;

  return useQuery({
    queryKey: ["businessCabinetCatalogCategories", locale, defaultKey] as const,
    enabled:
      enabled && status === "authenticated" && accessToken.length > 0,
    queryFn: async (): Promise<Cat[]> => {
      const { data, error } = await catalogGetCategoriesByMajorSlug({
        client: sdk,
        path: { majorSlug: CATALOG_MAJOR_CATEGORY_SLUG },
        query: { locale },
      });
      if (error || !data?.categories?.length) {
        throw new Error("business cabinet catalog");
      }
      return data.categories.map((x) => ({
        id: x.id,
        slug: x.slug,
        name: x.name,
        shortName: x.shortName,
        description: x.description,
        label: x.name,
      }));
    },
  });
}
