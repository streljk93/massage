"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import type { AppLocale } from "@/app/i18n/routing";
import {
  catalogGetCategoriesByMajorSlug,
  createBrowserSdkClient,
} from "@/shared/api";
import { CATALOG_MAJOR_CATEGORY_SLUG } from "@/shared/config/catalog-major-category";

export type BusinessSalonCategoryOption = {
  id: string;
  slug: string;
  label: string;
};

export function businessSalonCatalogQueryKey(locale: string) {
  return ["businessSalonCatalog", CATALOG_MAJOR_CATEGORY_SLUG, locale] as const;
}

/**
 * Рубрики каталога для формы создания салона вне онбординга (кабинет).
 */
export function useBusinessSalonCatalogCategories(enabled: boolean) {
  const locale = useLocale() as AppLocale;
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken ?? "";
  const sdk = useMemo(
    () => createBrowserSdkClient(accessToken, { locale }),
    [accessToken, locale],
  );

  return useQuery({
    queryKey: [...businessSalonCatalogQueryKey(locale), accessToken],
    enabled: enabled && status === "authenticated" && accessToken.length > 0,
    queryFn: async (): Promise<BusinessSalonCategoryOption[]> => {
      const { data, error } = await catalogGetCategoriesByMajorSlug({
        client: sdk,
        path: { majorSlug: CATALOG_MAJOR_CATEGORY_SLUG },
        query: { locale },
      });
      if (error || !data?.categories?.length) {
        throw new Error("business salon catalog");
      }
      return data.categories.map((x) => ({
        id: x.id,
        slug: x.slug,
        label: x.shortName,
      }));
    },
  });
}
