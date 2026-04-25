import { Suspense } from "react";
import { getLocale } from "next-intl/server";
import type { AppLocale } from "@/app/i18n/routing";
import {
  createServerSdkClient,
  organizationsList,
  serverSdkFetchNoStore,
  specialistsList,
} from "@/shared/api";
import { SEARCH_DIRECTORY_CURSOR_PAGE_SIZE } from "@/shared/config/directory-cursor-pagination";
import { CATALOG_MAJOR_CATEGORY_SLUG } from "@/shared/config/catalog-major-category";
import {
  searchCategoriesQueryCsv,
  searchDirectoryListSortForPublicApi,
} from "@/views/search/lib/search-directory-list-api-filters";
import { parseSearchUrlFiltersFromRecord } from "@/views/search/lib/search-url-filters";
import { SearchPageClient } from "@/views/search";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: PageProps) {
  const locale = (await getLocale()) as AppLocale;
  const sp = (await searchParams) ?? {};
  const f = parseSearchUrlFiltersFromRecord(sp);
  const listSort = searchDirectoryListSortForPublicApi(f.sort);
  const hasRadius =
    f.radiusM != null &&
    f.radiusLat != null &&
    f.radiusLng != null;
  const orgCategoriesCsv = searchCategoriesQueryCsv(f.orgCategorySlugs);
  const specCategoriesCsv = searchCategoriesQueryCsv(f.specCategorySlugs);

  const sdkClient = createServerSdkClient();
  let initialOrganizationsPage = null;
  let initialSpecialistsPage = null;
  if (sdkClient) {
    const [orgRes, specRes] = await Promise.all([
      organizationsList({
        client: sdkClient,
        query: {
          locale,
          majorSlug: CATALOG_MAJOR_CATEGORY_SLUG,
          limit: SEARCH_DIRECTORY_CURSOR_PAGE_SIZE,
          sort: listSort,
          ...(f.q.trim() ? { q: f.q.trim() } : {}),
          ...(orgCategoriesCsv ? { categories: orgCategoriesCsv } : {}),
          ...(hasRadius ?
            {
              radiusM: f.radiusM as number,
              radiusLat: f.radiusLat as number,
              radiusLng: f.radiusLng as number,
            }
          : {}),
        },
        fetch: serverSdkFetchNoStore,
      }),
      specialistsList({
        client: sdkClient,
        query: {
          locale,
          majorSlug: CATALOG_MAJOR_CATEGORY_SLUG,
          limit: SEARCH_DIRECTORY_CURSOR_PAGE_SIZE,
          sort: listSort,
          ...(f.q.trim() ? { q: f.q.trim() } : {}),
          ...(specCategoriesCsv ? { categories: specCategoriesCsv } : {}),
          ...(f.priceMinVnd != null ? { priceMinVnd: f.priceMinVnd } : {}),
          ...(f.priceMaxVnd != null ? { priceMaxVnd: f.priceMaxVnd } : {}),
          ...(hasRadius ?
            {
              radiusM: f.radiusM as number,
              radiusLat: f.radiusLat as number,
              radiusLng: f.radiusLng as number,
            }
          : {}),
        },
        fetch: serverSdkFetchNoStore,
      }),
    ]);
    if (!orgRes.error && orgRes.data) {
      initialOrganizationsPage = orgRes.data;
    }
    if (!specRes.error && specRes.data) {
      initialSpecialistsPage = specRes.data;
    }
  }

  const initialOrgListPrefetch = {
    q: f.q.trim(),
    categoryCsv: orgCategoriesCsv,
    sort: listSort,
    radiusM: hasRadius ? f.radiusM : null,
    radiusLat: hasRadius ? f.radiusLat : null,
    radiusLng: hasRadius ? f.radiusLng : null,
  };
  const initialSpecListPrefetch = {
    q: f.q.trim(),
    categoryCsv: specCategoriesCsv,
    sort: listSort,
    priceMinVnd: f.priceMinVnd,
    priceMaxVnd: f.priceMaxVnd,
    radiusM: hasRadius ? f.radiusM : null,
    radiusLat: hasRadius ? f.radiusLat : null,
    radiusLng: hasRadius ? f.radiusLng : null,
  };

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col bg-surface-background" />
      }
    >
      <div className="flex min-h-screen flex-col">
        <SearchPageClient
          initialOrganizationsPage={initialOrganizationsPage}
          initialSpecialistsPage={initialSpecialistsPage}
          initialOrgListPrefetch={initialOrgListPrefetch}
          initialSpecListPrefetch={initialSpecListPrefetch}
        />
      </div>
    </Suspense>
  );
}
