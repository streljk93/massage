import { useInfiniteQuery } from "@tanstack/react-query";
import type { AppLocale } from "@/app/i18n/routing";
import {
  createBrowserSdkClient,
  organizationsList,
  specialistsList,
  type OrganizationsListResponse,
  type SpecialistsListResponse,
} from "@/shared/api";
import { CATALOG_MAJOR_CATEGORY_SLUG } from "@/shared/config/catalog-major-category";
import { SEARCH_DIRECTORY_CURSOR_PAGE_SIZE } from "@/shared/config/directory-cursor-pagination";
import {
  searchCategoriesQueryCsv,
  searchDirectoryRadiusActive,
  searchOrganizationsFiltersEmpty,
  searchSpecialistsFiltersEmpty,
  type SearchOrganizationsListApiFilters,
  type SearchSpecialistsListApiFilters,
} from "./search-directory-list-api-filters";

const SEARCH_DIRECTORY_STALE_MS = 120_000;

type CursorPagePayload = {
  cursorPage: { hasMore: boolean; nextCursor: string | null };
};

function getNextCursorPageParam(last: CursorPagePayload): string | undefined {
  return last.cursorPage.hasMore ?
      (last.cursorPage.nextCursor ?? undefined)
    : undefined;
}

export type SearchOrganizationsListPrefetchSnapshot = {
  q: string;
  categoryCsv: string;
  radiusM: number | null;
  radiusLat: number | null;
  radiusLng: number | null;
};

export type SearchSpecialistsListPrefetchSnapshot = {
  q: string;
  categoryCsv: string;
  priceMinVnd: number | null;
  priceMaxVnd: number | null;
  radiusM: number | null;
  radiusLat: number | null;
  radiusLng: number | null;
};

function organizationsInitialPageMatchesSnapshot(
  filters: SearchOrganizationsListApiFilters,
  snapshot: SearchOrganizationsListPrefetchSnapshot | null,
): boolean {
  if (snapshot == null) {
    return false;
  }
  const qTrim = filters.q.trim();
  const categoryCsv = searchCategoriesQueryCsv(filters.categorySlugs);
  return (
    qTrim === snapshot.q.trim() &&
    categoryCsv === snapshot.categoryCsv &&
    filters.radiusM === snapshot.radiusM &&
    filters.radiusLat === snapshot.radiusLat &&
    filters.radiusLng === snapshot.radiusLng
  );
}

/** Курсорная бесконечная лента салонов на экране поиска (SSR первая страница + клиент). */
export function useSearchOrganizationsCursorInfiniteQuery(
  locale: AppLocale,
  accessToken: string,
  initialPage: OrganizationsListResponse | null,
  filters: SearchOrganizationsListApiFilters,
  listPrefetchSnapshot: SearchOrganizationsListPrefetchSnapshot | null = null,
) {
  const filtersEmpty = searchOrganizationsFiltersEmpty(filters);
  const qTrim = filters.q.trim();
  const categoryCsv = searchCategoriesQueryCsv(filters.categorySlugs);
  const radiusQ = searchDirectoryRadiusActive(filters);
  const useInitialPage =
    initialPage != null &&
    (filtersEmpty ||
      organizationsInitialPageMatchesSnapshot(filters, listPrefetchSnapshot));

  return useInfiniteQuery({
    queryKey: [
      "searchDirectoryOrganizations",
      locale,
      CATALOG_MAJOR_CATEGORY_SLUG,
      qTrim,
      categoryCsv,
      radiusQ ? (filters.radiusM ?? "x") : "noR",
      radiusQ ? (filters.radiusLat ?? "x") : "noR",
      radiusQ ? (filters.radiusLng ?? "x") : "noR",
    ] as const,
    initialData:
      useInitialPage ?
        {
          pages: [initialPage],
          pageParams: [undefined],
        }
      : undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: SEARCH_DIRECTORY_STALE_MS,
    queryFn: async ({ pageParam }) => {
      const res = await organizationsList({
        client: createBrowserSdkClient(accessToken, { locale }),
        query: {
          locale,
          majorSlug: CATALOG_MAJOR_CATEGORY_SLUG,
          limit: SEARCH_DIRECTORY_CURSOR_PAGE_SIZE,
          ...(pageParam ? { cursor: String(pageParam) } : {}),
          ...(qTrim ? { q: qTrim } : {}),
          ...(categoryCsv ? { categories: categoryCsv } : {}),
          ...(radiusQ ?
            {
              radiusM: filters.radiusM as number,
              radiusLat: filters.radiusLat as number,
              radiusLng: filters.radiusLng as number,
            }
          : {}),
        },
      });
      if (res.error || !res.data) {
        throw new Error("organizations list");
      }
      return res.data;
    },
    getNextPageParam: getNextCursorPageParam,
  });
}

function specialistsInitialPageMatchesSnapshot(
  filters: SearchSpecialistsListApiFilters,
  snapshot: SearchSpecialistsListPrefetchSnapshot | null,
): boolean {
  if (snapshot == null) {
    return false;
  }
  const qTrim = filters.q.trim();
  const categoryCsv = searchCategoriesQueryCsv(filters.categorySlugs);
  const { priceMinVnd, priceMaxVnd } = filters;
  return (
    qTrim === snapshot.q.trim() &&
    categoryCsv === snapshot.categoryCsv &&
    priceMinVnd === snapshot.priceMinVnd &&
    priceMaxVnd === snapshot.priceMaxVnd &&
    filters.radiusM === snapshot.radiusM &&
    filters.radiusLat === snapshot.radiusLat &&
    filters.radiusLng === snapshot.radiusLng
  );
}

/** То же для специалистов. */
export function useSearchSpecialistsCursorInfiniteQuery(
  locale: AppLocale,
  accessToken: string,
  initialPage: SpecialistsListResponse | null,
  filters: SearchSpecialistsListApiFilters,
  listPrefetchSnapshot: SearchSpecialistsListPrefetchSnapshot | null = null,
) {
  const filtersEmpty = searchSpecialistsFiltersEmpty(filters);
  const qTrim = filters.q.trim();
  const categoryCsv = searchCategoriesQueryCsv(filters.categorySlugs);
  const { priceMinVnd, priceMaxVnd } = filters;
  const radiusQ = searchDirectoryRadiusActive(filters);
  const useInitialPage =
    initialPage != null &&
    (filtersEmpty ||
      specialistsInitialPageMatchesSnapshot(filters, listPrefetchSnapshot));

  return useInfiniteQuery({
    queryKey: [
      "searchDirectorySpecialists",
      locale,
      CATALOG_MAJOR_CATEGORY_SLUG,
      qTrim,
      categoryCsv,
      priceMinVnd ?? "none",
      priceMaxVnd ?? "none",
      radiusQ ? (filters.radiusM ?? "x") : "noR",
      radiusQ ? (filters.radiusLat ?? "x") : "noR",
      radiusQ ? (filters.radiusLng ?? "x") : "noR",
    ] as const,
    initialData:
      useInitialPage ?
        {
          pages: [initialPage],
          pageParams: [undefined],
        }
      : undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: SEARCH_DIRECTORY_STALE_MS,
    queryFn: async ({ pageParam }) => {
      const res = await specialistsList({
        client: createBrowserSdkClient(accessToken, { locale }),
        query: {
          locale,
          majorSlug: CATALOG_MAJOR_CATEGORY_SLUG,
          limit: SEARCH_DIRECTORY_CURSOR_PAGE_SIZE,
          ...(pageParam ? { cursor: String(pageParam) } : {}),
          ...(qTrim ? { q: qTrim } : {}),
          ...(categoryCsv ? { categories: categoryCsv } : {}),
          ...(priceMinVnd != null ? { priceMinVnd } : {}),
          ...(priceMaxVnd != null ? { priceMaxVnd } : {}),
          ...(radiusQ ?
            {
              radiusM: filters.radiusM as number,
              radiusLat: filters.radiusLat as number,
              radiusLng: filters.radiusLng as number,
            }
          : {}),
        },
      });
      if (res.error || !res.data) {
        throw new Error("specialists list");
      }
      return res.data;
    },
    getNextPageParam: getNextCursorPageParam,
  });
}
