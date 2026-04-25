import { Suspense } from "react";
import { getLocale } from "next-intl/server";
import type { AppLocale } from "@/app/i18n/routing";
import {
  createServerSdkClient,
  fetchAllOrganizationsPages,
  fetchAllSpecialistsPages,
  serverSdkFetchNoStore,
} from "@/shared/api";
import {
  searchCategoriesQueryCsv,
  searchDirectoryListSortForPublicApi,
} from "@/views/search/lib/search-directory-list-api-filters";
import { parseSearchUrlFiltersFromRecord } from "@/views/search/lib/search-url-filters";
import { SearchMapPageClient } from "@/views/search";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: PageProps) {
  const locale = (await getLocale()) as AppLocale;
  const sp = (await searchParams) ?? {};
  const f = parseSearchUrlFiltersFromRecord(sp);
  const listSort = searchDirectoryListSortForPublicApi(f.sort);
  const orgCategoriesCsv = searchCategoriesQueryCsv(f.orgCategorySlugs);
  const specCategoriesCsv = searchCategoriesQueryCsv(f.specCategorySlugs);
  const hasRadius =
    f.radiusM != null && f.radiusLat != null && f.radiusLng != null;
  const radius =
    hasRadius ?
      {
        radiusM: f.radiusM as number,
        radiusLat: f.radiusLat as number,
        radiusLng: f.radiusLng as number,
      }
    : null;
  const orgListQuery = {
    sort: listSort,
    ...(f.q.trim() ? { q: f.q.trim() } : {}),
    ...(orgCategoriesCsv ? { categories: orgCategoriesCsv } : {}),
  };
  const specListQuery = {
    sort: listSort,
    ...(f.q.trim() ? { q: f.q.trim() } : {}),
    ...(specCategoriesCsv ? { categories: specCategoriesCsv } : {}),
    ...(f.priceMinVnd != null ? { priceMinVnd: f.priceMinVnd } : {}),
    ...(f.priceMaxVnd != null ? { priceMaxVnd: f.priceMaxVnd } : {}),
  };
  const sdkClient = createServerSdkClient();
  let initialOrganizations = null;
  let initialSpecialists = null;
  if (sdkClient) {
    try {
      const [orgs, specs] = await Promise.all([
        fetchAllOrganizationsPages({
          client: sdkClient,
          locale,
          fetch: serverSdkFetchNoStore,
          radius,
          listQuery: orgListQuery,
        }),
        fetchAllSpecialistsPages({
          client: sdkClient,
          locale,
          fetch: serverSdkFetchNoStore,
          radius,
          listQuery: specListQuery,
        }),
      ]);
      initialOrganizations = orgs;
      initialSpecialists = specs;
    } catch {
      initialOrganizations = null;
      initialSpecialists = null;
    }
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col bg-surface-background" />
      }
    >
      <SearchMapPageClient
        initialOrganizations={initialOrganizations}
        initialSpecialists={initialSpecialists}
      />
    </Suspense>
  );
}
