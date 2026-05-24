import { Suspense } from "react";
import { getLocale } from "next-intl/server";
import type { AppLocale } from "@/app/i18n/routing";
import {
  createServerSdkClient,
  directoryGetCatalogFilterOptions,
  organizationsList,
  serverSdkFetchNoStore,
  specialistsList,
  type DirectoryGetCatalogFilterOptionsResponse,
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
  const orgBodyZonesCsv = searchCategoriesQueryCsv(f.orgBodyZoneSlugs);
  const specBodyZonesCsv = searchCategoriesQueryCsv(f.specBodyZoneSlugs);

  const sdkClient = createServerSdkClient();
  let initialOrganizationsPage = null;
  let initialSpecialistsPage = null;
  let initialCatalogFilterOrganizations: DirectoryGetCatalogFilterOptionsResponse | null =
    null;
  let initialCatalogFilterSpecialists: DirectoryGetCatalogFilterOptionsResponse | null =
    null;
  if (sdkClient) {
    const [orgRes, specRes, orgFilterRes, specFilterRes] = await Promise.all([
      organizationsList({
        client: sdkClient,
        query: {
          locale,
          majorSlug: CATALOG_MAJOR_CATEGORY_SLUG,
          limit: SEARCH_DIRECTORY_CURSOR_PAGE_SIZE,
          sort: listSort,
          ...(f.q.trim() ? { q: f.q.trim() } : {}),
          ...(orgCategoriesCsv ? { categories: orgCategoriesCsv } : {}),
          ...(orgBodyZonesCsv ? ({ bodyZones: orgBodyZonesCsv } as Record<string, unknown>) : {}),
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
          ...(specBodyZonesCsv ? ({ bodyZones: specBodyZonesCsv } as Record<string, unknown>) : {}),
          ...(f.priceMinVnd != null ? { priceMinVnd: f.priceMinVnd } : {}),
          ...(f.priceMaxVnd != null ? { priceMaxVnd: f.priceMaxVnd } : {}),
          ...(f.specialistGender != null ?
            ({ gender: f.specialistGender } as Record<string, unknown>)
          : {}),
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
      directoryGetCatalogFilterOptions({
        client: sdkClient,
        query: { locale, tab: "organizations" },
        fetch: serverSdkFetchNoStore,
      }),
      directoryGetCatalogFilterOptions({
        client: sdkClient,
        query: { locale, tab: "specialists" },
        fetch: serverSdkFetchNoStore,
      }),
    ]);
    if (!orgRes.error && orgRes.data) {
      initialOrganizationsPage = orgRes.data;
    }
    if (!specRes.error && specRes.data) {
      initialSpecialistsPage = specRes.data;
    }
    if (!orgFilterRes.error && orgFilterRes.data) {
      initialCatalogFilterOrganizations = orgFilterRes.data;
    }
    if (!specFilterRes.error && specFilterRes.data) {
      initialCatalogFilterSpecialists = specFilterRes.data;
    }
  }

  const initialOrgListPrefetch = {
    q: f.q.trim(),
    categoryCsv: orgCategoriesCsv,
    bodyZoneCsv: orgBodyZonesCsv,
    sort: listSort,
    radiusM: hasRadius ? f.radiusM : null,
    radiusLat: hasRadius ? f.radiusLat : null,
    radiusLng: hasRadius ? f.radiusLng : null,
  };
  const initialSpecListPrefetch = {
    q: f.q.trim(),
    categoryCsv: specCategoriesCsv,
    bodyZoneCsv: specBodyZonesCsv,
    sort: listSort,
    priceMinVnd: f.priceMinVnd,
    priceMaxVnd: f.priceMaxVnd,
    gender: f.specialistGender,
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
          initialCatalogFilterOrganizations={initialCatalogFilterOrganizations}
          initialCatalogFilterSpecialists={initialCatalogFilterSpecialists}
          initialListingNowIso={new Date().toISOString()}
        />
      </div>
    </Suspense>
  );
}
