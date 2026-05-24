"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  directoryOrganizationHasFreeSlotAt,
  directorySpecialistHasFreeSlotAt,
} from "@/shared/lib/directory-matches-free-slot";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import {
  ArrowUpDown,
  CalendarClock,
  Map as MapIcon,
  Search as SearchIcon,
  SearchX,
  SlidersHorizontal,
} from "lucide-react";
import { OrganizationCard } from "@/entities/organizations";
import { SpecialistCard } from "@/entities/specialists";
import type { AppLocale } from "@/app/i18n/routing";
import { Link, usePathname, useRouter } from "@/app/i18n/navigation";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/shadcn/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/shadcn/empty";
import {
  HomeBottomNav,
  HomeScreenHeader,
  consumerPageMainClass,
  consumerPageRootClass,
} from "@/widgets/home";
import {
  createBrowserSdkClient,
  directoryGetCatalogFilterOptions,
  personalizationGetRecommendations,
  type DirectoryGetCatalogFilterOptionsResponse,
  type OrganizationsListResponse,
  type SpecialistsListResponse,
} from "@/shared/api";
import { useCursorPaginationSentinel } from "@/shared/lib/use-cursor-pagination-sentinel";
import { useDelayedLoadingIndicator } from "@/shared/lib/use-delayed-loading-indicator";
import { useListingClock } from "@/shared/lib/use-listing-clock";
import { formatVndListingLabel } from "@/shared/lib/vnd-amount-input";
import {
  CursorPaginationDirectoryCardSkeleton,
  CursorPaginationDirectoryListSkeleton,
} from "@/shared/ui/cursor-pagination-directory-card-skeleton";
import { organizationCardSeedFromApi } from "@/entities/organizations";
import { specialistCardSeedFromApi } from "@/entities/specialists";
import { homeUser } from "@/widgets/home/lib/mock-data";
import { slotGroupsFromSeed } from "@/widgets/home/lib/slot-groups-from-seed";
import { cn, motion } from "@/shared/lib";
import {
  type SearchOrganizationsListPrefetchSnapshot,
  type SearchSpecialistsListPrefetchSnapshot,
  useSearchOrganizationsCursorInfiniteQuery,
  useSearchSpecialistsCursorInfiniteQuery,
} from "../lib/use-search-directory-cursor-infinite-queries";
import {
  effectiveSearchDirectoryListSort,
  searchCategoriesQueryCsv,
  SEARCH_DIRECTORY_DEFAULT_SORT,
  SEARCH_DIRECTORY_LIST_SORT_BASE_VALUES,
  type SearchDirectoryListSort,
  type SearchOrganizationsListApiFilters,
  type SearchSpecialistsListApiFilters,
} from "../lib/search-directory-list-api-filters";
import { SEARCH_TABS, type SearchTab } from "@/shared/lib/search-tab";
import { CATALOG_MAJOR_CATEGORY_SLUG } from "@/shared/config/catalog-major-category";
import { SEARCH_DIRECTORY_CURSOR_PAGE_SIZE } from "@/shared/config/directory-cursor-pagination";
import { trackSearchFiltersApplied } from "@/shared/lib/personalization/personalization-track";
import {
  applySearchUrlPatch,
  buildSearchFiltersResultHintSignature,
  buildSearchMapQueryString,
  buildSearchQueryString,
  parseSearchUrlFilters,
  type SearchUrlFilters,
} from "../lib/search-url-filters";
import {
  buildSearchSlotTimeOptions,
} from "../lib/search-slot-time-options";
import { SearchFiltersResultHint } from "./search-filters-result-hint";
import { SearchFiltersSidebar } from "./search-filters-sidebar";
import {
  CatalogFilters,
  priceSliderStep,
  specialistListPriceBounds,
  type CatalogFiltersProps,
  type CatalogSlotTimeFilterValue,
} from "@/entities/catalog";

export type SearchPageClientProps = {
  initialOrganizationsPage: OrganizationsListResponse | null;
  initialSpecialistsPage: SpecialistsListResponse | null;
  initialOrgListPrefetch: SearchOrganizationsListPrefetchSnapshot;
  initialSpecListPrefetch: SearchSpecialistsListPrefetchSnapshot;
  initialCatalogFilterOrganizations: DirectoryGetCatalogFilterOptionsResponse | null;
  initialCatalogFilterSpecialists: DirectoryGetCatalogFilterOptionsResponse | null;
  /** ISO-время с SSR для согласованной гидрации слотов и карточек. */
  initialListingNowIso: string;
};

export function SearchPageClient({
  initialOrganizationsPage,
  initialSpecialistsPage,
  initialOrgListPrefetch,
  initialSpecListPrefetch,
  initialCatalogFilterOrganizations,
  initialCatalogFilterSpecialists,
  initialListingNowIso,
}: SearchPageClientProps) {
  const tSearch = useTranslations("search");
  const tSlots = useTranslations("slots");
  const format = useFormatter();
  const locale = useLocale() as AppLocale;
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? "";
  const listingNow = useListingClock(60_000, initialListingNowIso);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const urlFilters = useMemo(
    () => parseSearchUrlFilters(searchParams),
    [searchParams],
  );
  const tab = urlFilters.tab;

  const hasRadiusFilter =
    urlFilters.radiusM != null &&
    urlFilters.radiusLat != null &&
    urlFilters.radiusLng != null;

  const recQueryClient = useMemo(
    () => createBrowserSdkClient(accessToken, { locale }),
    [accessToken, locale],
  );

  const categorySlugsForRec = useMemo(
    () =>
      tab === "organizations" ?
        urlFilters.orgCategorySlugs
      : urlFilters.specCategorySlugs,
    [tab, urlFilters.orgCategorySlugs, urlFilters.specCategorySlugs],
  );

  const categoriesCsvForRec = useMemo(
    () => searchCategoriesQueryCsv(categorySlugsForRec),
    [categorySlugsForRec],
  );

  const { data: recMeta } = useQuery({
    queryKey: [
      "personalizationSearchSortMeta",
      accessToken,
      locale,
      CATALOG_MAJOR_CATEGORY_SLUG,
      categoriesCsvForRec,
      urlFilters.priceMinVnd,
      urlFilters.priceMaxVnd,
      hasRadiusFilter,
      hasRadiusFilter ? urlFilters.radiusM : null,
      hasRadiusFilter ? urlFilters.radiusLat : null,
      hasRadiusFilter ? urlFilters.radiusLng : null,
    ] as const,
    queryFn: async () => {
      const { data, error } = await personalizationGetRecommendations({
        client: recQueryClient,
        query: {
          locale,
          listLimit: 0,
          majorSlug: CATALOG_MAJOR_CATEGORY_SLUG,
          ...(categoriesCsvForRec ? { categories: categoriesCsvForRec } : {}),
          ...(urlFilters.priceMinVnd != null && urlFilters.priceMaxVnd != null ?
            {
              priceMinVnd: urlFilters.priceMinVnd,
              priceMaxVnd: urlFilters.priceMaxVnd,
            }
          : {}),
          ...(hasRadiusFilter ?
            {
              radiusM: urlFilters.radiusM as number,
              radiusLat: urlFilters.radiusLat as number,
              radiusLng: urlFilters.radiusLng as number,
            }
          : {}),
        },
      });
      if (error || !data) {
        throw new Error("personalization recommendations meta");
      }
      return data;
    },
    enabled: accessToken.length > 0,
    staleTime: 60_000,
  });

  const listSortEffective = useMemo(
    () =>
      effectiveSearchDirectoryListSort(urlFilters.sort, {
        accessToken,
        personalizationReady: recMeta?.personalizationReady,
      }),
    [urlFilters.sort, accessToken, recMeta?.personalizationReady],
  );

  const showRecommendedSortOption = Boolean(
    accessToken.length > 0 && recMeta?.personalizationReady,
  );

  const selectSortValue = useMemo((): SearchDirectoryListSort => {
    if (urlFilters.sort === "recommended" && !showRecommendedSortOption) {
      return listSortEffective;
    }
    return urlFilters.sort;
  }, [urlFilters.sort, showRecommendedSortOption, listSortEffective]);

  const replaceUrlFilters = useCallback(
    (next: SearchUrlFilters) => {
      const qs = buildSearchQueryString(next);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  useLayoutEffect(() => {
    if (searchParams.get("filters") !== "1") {
      return;
    }
    const desktop =
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1024px)").matches;
    if (!desktop) {
      setFiltersOpen(true);
    }
    const next = new URLSearchParams(searchParams.toString());
    next.delete("filters");
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  const urlFiltersRef = useRef(urlFilters);

  useEffect(() => {
    urlFiltersRef.current = urlFilters;
  }, [urlFilters]);

  const [qDraft, setQDraft] = useState(urlFilters.q);
  const qDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const priceFilterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localSpecPriceRange, setLocalSpecPriceRange] = useState<
    [number, number] | null
  >(null);

  // Синхронизация черновика строки поиска с URL (назад/вперёд, обновление query не из поля).
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- qDraft дублирует URL между debounce-событиями
    setQDraft(urlFilters.q);
  }, [urlFilters.q]);

  useEffect(() => {
    return () => {
      if (qDebounceRef.current != null) {
        clearTimeout(qDebounceRef.current);
      }
      if (priceFilterDebounceRef.current != null) {
        clearTimeout(priceFilterDebounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const categorySlugs =
      urlFilters.tab === "organizations" ?
        urlFilters.orgCategorySlugs
      : urlFilters.specCategorySlugs;
    const tid = window.setTimeout(() => {
      trackSearchFiltersApplied({
        accessToken: accessToken || undefined,
        majorSlug: CATALOG_MAJOR_CATEGORY_SLUG,
        categorySlugs,
        sort: urlFilters.sort,
        radiusM: urlFilters.radiusM,
        radiusLat: urlFilters.radiusLat,
        radiusLng: urlFilters.radiusLng,
        priceMinVnd: urlFilters.priceMinVnd,
        priceMaxVnd: urlFilters.priceMaxVnd,
      });
    }, 800);
    return () => window.clearTimeout(tid);
  }, [
    urlFilters.tab,
    urlFilters.orgCategorySlugs,
    urlFilters.specCategorySlugs,
    urlFilters.sort,
    urlFilters.radiusM,
    urlFilters.radiusLat,
    urlFilters.radiusLng,
    urlFilters.priceMinVnd,
    urlFilters.priceMaxVnd,
    accessToken,
  ]);

  const commitUrlFilters = useCallback(
    (next: SearchUrlFilters) => {
      if (qDebounceRef.current != null) {
        clearTimeout(qDebounceRef.current);
        qDebounceRef.current = null;
      }
      replaceUrlFilters(next);
    },
    [replaceUrlFilters],
  );

  const commitFilterPatch = useCallback(
    (patch: Partial<SearchUrlFilters>) => {
      commitUrlFilters(applySearchUrlPatch(urlFiltersRef.current, patch));
    },
    [commitUrlFilters],
  );

  const applySearchSort = useCallback(
    (v: SearchDirectoryListSort) => {
      const isRecommended = v === "recommended";
      const inBase = (
        SEARCH_DIRECTORY_LIST_SORT_BASE_VALUES as readonly string[]
      ).includes(v);
      if (!inBase && (!isRecommended || !showRecommendedSortOption)) {
        return;
      }
      commitUrlFilters(
        applySearchUrlPatch(urlFiltersRef.current, { sort: v }),
      );
    },
    [commitUrlFilters, showRecommendedSortOption],
  );

  useEffect(() => {
    if (urlFilters.sort !== "recommended") {
      return;
    }
    if (!accessToken) {
      commitUrlFilters(
        applySearchUrlPatch(urlFiltersRef.current, { sort: "popularity" }),
      );
      return;
    }
    if (recMeta && !recMeta.personalizationReady) {
      commitUrlFilters(
        applySearchUrlPatch(urlFiltersRef.current, { sort: "popularity" }),
      );
    }
  }, [urlFilters.sort, accessToken, recMeta, commitUrlFilters]);

  const filterPriceByTab = useMemo(
    () => ({
      organizations: null as null,
      specialists:
        urlFilters.priceMinVnd != null && urlFilters.priceMaxVnd != null ?
          { min: urlFilters.priceMinVnd, max: urlFilters.priceMaxVnd }
        : null,
    }),
    [urlFilters.priceMinVnd, urlFilters.priceMaxVnd],
  );

  const filterCategorySlugs =
    tab === "organizations" ?
      urlFilters.orgCategorySlugs
    : urlFilters.specCategorySlugs;
  const filterBodyZoneSlugs =
    tab === "organizations" ?
      urlFilters.orgBodyZoneSlugs
    : urlFilters.specBodyZoneSlugs;

  const slotPickValue = useMemo(
    (): CatalogSlotTimeFilterValue => ({
      day: urlFilters.slotDay ?? "",
      time: urlFilters.slotTime ?? "",
    }),
    [urlFilters.slotDay, urlFilters.slotTime],
  );

  const orgApiFilters = useMemo((): SearchOrganizationsListApiFilters => {
    return {
      q: urlFilters.q,
      categorySlugs: urlFilters.orgCategorySlugs,
      bodyZoneSlugs: urlFilters.orgBodyZoneSlugs,
      sort: listSortEffective,
      radiusM: hasRadiusFilter ? urlFilters.radiusM : null,
      radiusLat: hasRadiusFilter ? urlFilters.radiusLat : null,
      radiusLng: hasRadiusFilter ? urlFilters.radiusLng : null,
    };
  }, [
    urlFilters.q,
    urlFilters.orgCategorySlugs,
    urlFilters.orgBodyZoneSlugs,
    listSortEffective,
    hasRadiusFilter,
    urlFilters.radiusM,
    urlFilters.radiusLat,
    urlFilters.radiusLng,
  ]);

  const specApiFilters = useMemo((): SearchSpecialistsListApiFilters => {
    return {
      q: urlFilters.q,
      categorySlugs: urlFilters.specCategorySlugs,
      bodyZoneSlugs: urlFilters.specBodyZoneSlugs,
      sort: listSortEffective,
      priceMinVnd: urlFilters.priceMinVnd,
      priceMaxVnd: urlFilters.priceMaxVnd,
      gender: urlFilters.specialistGender,
      radiusM: hasRadiusFilter ? urlFilters.radiusM : null,
      radiusLat: hasRadiusFilter ? urlFilters.radiusLat : null,
      radiusLng: hasRadiusFilter ? urlFilters.radiusLng : null,
    };
  }, [
    urlFilters.q,
    urlFilters.specCategorySlugs,
    urlFilters.specBodyZoneSlugs,
    listSortEffective,
    urlFilters.priceMinVnd,
    urlFilters.priceMaxVnd,
    urlFilters.specialistGender,
    hasRadiusFilter,
    urlFilters.radiusM,
    urlFilters.radiusLat,
    urlFilters.radiusLng,
  ]);

  const organizationsInfinite = useSearchOrganizationsCursorInfiniteQuery(
    locale,
    accessToken,
    initialOrganizationsPage,
    orgApiFilters,
    initialOrgListPrefetch,
  );

  const specialistsInfinite = useSearchSpecialistsCursorInfiniteQuery(
    locale,
    accessToken,
    initialSpecialistsPage,
    specApiFilters,
    initialSpecListPrefetch,
  );

  const organizations = useMemo(
    () =>
      organizationsInfinite.data?.pages.flatMap((p) => p.organizations) ?? [],
    [organizationsInfinite.data],
  );
  const specialists = useMemo(
    () =>
      specialistsInfinite.data?.pages.flatMap((p) => p.specialists) ?? [],
    [specialistsInfinite.data],
  );

  const slotTimeOptionsStatic = useMemo(() => buildSearchSlotTimeOptions(), []);

  const displayOrganizations = useMemo(() => {
    const d = urlFilters.slotDay;
    const tm = urlFilters.slotTime;
    let out = organizations;
    if (d && tm) {
      out = out.filter((o) =>
        directoryOrganizationHasFreeSlotAt(o, d, tm, listingNow),
      );
    }
    return out;
  }, [
    organizations,
    urlFilters.slotDay,
    urlFilters.slotTime,
    listingNow,
  ]);

  const displaySpecialists = useMemo(() => {
    const d = urlFilters.slotDay;
    const tm = urlFilters.slotTime;
    let out = specialists;
    if (d && tm) {
      out = out.filter((s) =>
        directorySpecialistHasFreeSlotAt(s, d, tm, listingNow),
      );
    }
    return out;
  }, [
    specialists,
    urlFilters.slotDay,
    urlFilters.slotTime,
    listingNow,
  ]);

  const orgSentinelRef = useCursorPaginationSentinel({
    enabled: tab === "organizations",
    hasNextPage: organizationsInfinite.hasNextPage,
    isFetchingNextPage: organizationsInfinite.isFetchingNextPage,
    fetchNextPage: () => void organizationsInfinite.fetchNextPage(),
  });

  const specSentinelRef = useCursorPaginationSentinel({
    enabled: tab === "specialists",
    hasNextPage: specialistsInfinite.hasNextPage,
    isFetchingNextPage: specialistsInfinite.isFetchingNextPage,
    fetchNextPage: () => void specialistsInfinite.fetchNextPage(),
  });

  const categoryOptionsFallback = useMemo(() => {
    const list = tab === "organizations" ? organizations : specialists;
    const map = new Map<string, string>();
    for (const item of list) {
      for (const c of item.categories) {
        if (!map.has(c.slug)) map.set(c.slug, c.shortName);
      }
    }
    return Array.from(map, ([slug, shortName]) => ({ slug, shortName })).sort(
      (a, b) =>
        a.shortName.localeCompare(b.shortName, locale, { sensitivity: "base" }),
    );
  }, [tab, organizations, specialists, locale]);

  const catalogFilterInitialData = useMemo((): DirectoryGetCatalogFilterOptionsResponse | undefined => {
    const initial =
      tab === "organizations" ?
        initialCatalogFilterOrganizations
      : initialCatalogFilterSpecialists;
    return initial ?? undefined;
  }, [
    tab,
    initialCatalogFilterOrganizations,
    initialCatalogFilterSpecialists,
  ]);

  const { data: catalogFilterApi, isSuccess: catalogFilterQuerySuccess } =
    useQuery({
      queryKey: ["directoryCatalogFilter", tab, locale] as const,
      enabled: true,
      retry: 1,
      initialData: catalogFilterInitialData,
      staleTime: 5 * 60 * 1000,
      queryFn: async () => {
        const res = await directoryGetCatalogFilterOptions({
          client: createBrowserSdkClient(accessToken, { locale }),
          query: {
            tab:
              tab === "organizations" ? "organizations" : "specialists",
            locale,
          },
        });
        if (res.error) {
          throw new Error("catalog filter options");
        }
        return res.data;
      },
    });

  const categoryOptions = useMemo(() => {
    if (catalogFilterApi?.categories != null) {
      return catalogFilterApi.categories;
    }
    return categoryOptionsFallback;
  }, [catalogFilterApi, categoryOptionsFallback]);

  const bodyZoneOptions = useMemo(() => {
    const apiZones = (catalogFilterApi as { bodyZones?: Array<{ slug: string; name: string }> } | undefined)?.bodyZones;
    return apiZones ?? [];
  }, [catalogFilterApi]);
  const genderOptions = useMemo(() => {
    const apiGenders = (catalogFilterApi as { genders?: Array<"male" | "female"> } | undefined)?.genders;
    return apiGenders ?? [];
  }, [catalogFilterApi]);

  const priceSpecialistBounds = useMemo(
    () => specialistListPriceBounds(specialists),
    [specialists],
  );

  const specialistPriceExtent = useMemo(() => {
    return (
      catalogFilterApi?.priceRangeVnd ?? priceSpecialistBounds ?? null
    );
  }, [catalogFilterApi?.priceRangeVnd, priceSpecialistBounds]);

  const appliedSpecPriceRange = useMemo((): [number, number] | null => {
    if (specialistPriceExtent == null) {
      return null;
    }
    const ext = specialistPriceExtent;
    return [
      Math.max(
        ext.min,
        Math.min(urlFilters.priceMinVnd ?? ext.min, ext.max),
      ),
      Math.max(
        ext.min,
        Math.min(urlFilters.priceMaxVnd ?? ext.max, ext.max),
      ),
    ];
  }, [
    specialistPriceExtent,
    urlFilters.priceMinVnd,
    urlFilters.priceMaxVnd,
  ]);

  useEffect(() => {
    if (appliedSpecPriceRange != null) {
      setLocalSpecPriceRange(appliedSpecPriceRange);
    }
  }, [appliedSpecPriceRange]);

  const priceFilterForDialog = useMemo(() => {
    if (tab !== "specialists") {
      return null;
    }
    if (specialistPriceExtent == null || appliedSpecPriceRange == null) {
      return null;
    }
    const ext = specialistPriceExtent;
    const value = localSpecPriceRange ?? appliedSpecPriceRange;
    return {
      extent: ext,
      value,
      step: priceSliderStep(ext.min, ext.max),
      onValueChange: (v: [number, number]) => {
        setLocalSpecPriceRange(v);
        if (priceFilterDebounceRef.current != null) {
          clearTimeout(priceFilterDebounceRef.current);
        }
        priceFilterDebounceRef.current = setTimeout(() => {
          priceFilterDebounceRef.current = null;
          const base = urlFiltersRef.current;
          commitUrlFilters(
            applySearchUrlPatch(
              base,
              v[0] <= ext.min && v[1] >= ext.max ?
                { priceMinVnd: null, priceMaxVnd: null }
              : { priceMinVnd: v[0], priceMaxVnd: v[1] },
            ),
          );
        }, 300);
      },
      formatValue: formatVndListingLabel,
    };
  }, [
    tab,
    specialistPriceExtent,
    appliedSpecPriceRange,
    localSpecPriceRange,
    commitUrlFilters,
  ]);

  const readOnlyOrgVndLine = useMemo(() => {
    if (tab !== "organizations") {
      return null;
    }
    const r = catalogFilterApi?.priceRangeVnd;
    if (r == null) {
      return null;
    }
    return {
      min: formatVndListingLabel(r.min),
      max: formatVndListingLabel(r.max),
    };
  }, [tab, catalogFilterApi?.priceRangeVnd]);

  const hasPriceInListData = useMemo(
    () =>
      specialists.some((s) =>
        s.bookableServices.some(
          (svc) => (svc.priceVndByDuration?.length ?? 0) > 0,
        ),
      ),
    [specialists],
  );

  const hasActivePriceFilter =
    tab === "specialists" &&
    specialistPriceExtent != null &&
    filterPriceByTab.specialists != null &&
    (filterPriceByTab.specialists.min > specialistPriceExtent.min ||
      filterPriceByTab.specialists.max < specialistPriceExtent.max);

  const hasActiveSlotFilter =
    urlFilters.slotDay != null && urlFilters.slotTime != null;
  const hasAnySlotUrlPick =
    urlFilters.slotDay != null || urlFilters.slotTime != null;

  const hasActiveFilters =
    filterCategorySlugs.length > 0 ||
    filterBodyZoneSlugs.length > 0 ||
    (tab === "specialists" && urlFilters.specialistGender != null) ||
    hasActivePriceFilter ||
    hasAnySlotUrlPick ||
    hasRadiusFilter;

  const mapHref = useMemo(() => {
    const qs = buildSearchMapQueryString(urlFilters);
    return qs ? `/search/map?${qs}` : "/search/map";
  }, [urlFilters]);

  const radiusFilterDetailLabel = useMemo(() => {
    if (!hasRadiusFilter) {
      return undefined;
    }
    const m = urlFilters.radiusM as number;
    if (m >= 1000) {
      return `${format.number(m / 1000, { maximumFractionDigits: 1 })} km`;
    }
    return `${format.number(m, { maximumFractionDigits: 0 })} m`;
  }, [format, hasRadiusFilter, urlFilters.radiusM]);

  const searchDirectoryMatchingCount = useMemo(() => {
    if (tab === "organizations") {
      return organizationsInfinite.data?.pages[0]?.matchingCount;
    }
    return specialistsInfinite.data?.pages[0]?.matchingCount;
  }, [
    tab,
    organizationsInfinite.data?.pages,
    specialistsInfinite.data?.pages,
  ]);

  const filtersResultHintDisplayCount = useMemo(() => {
    if (hasActiveSlotFilter) {
      return (
        tab === "organizations" ?
          displayOrganizations.length
        : displaySpecialists.length
      );
    }
    return (
      searchDirectoryMatchingCount ??
      (tab === "organizations" ? organizations.length : specialists.length)
    );
  }, [
    hasActiveSlotFilter,
    tab,
    displayOrganizations.length,
    displaySpecialists.length,
    searchDirectoryMatchingCount,
    organizations.length,
    specialists.length,
  ]);

  const filtersResultHintSig = useMemo(
    () => buildSearchFiltersResultHintSignature(urlFilters),
    [urlFilters],
  );

  const hintActiveTabRef = useRef(tab);
  const filteredListCountHintRef = useRef(filtersResultHintDisplayCount);

  useEffect(() => {
    hintActiveTabRef.current = tab;
  }, [tab]);

  useEffect(() => {
    filteredListCountHintRef.current = filtersResultHintDisplayCount;
  }, [filtersResultHintDisplayCount]);

  const filtersHintPrevSigRef = useRef<string | null>(null);
  const filtersResultHintHideRef = useRef<number | null>(null);
  const [filtersResultHint, setFiltersResultHint] = useState<{
    key: number;
    count: number;
    tab: SearchTab;
  } | null>(null);

  useEffect(() => {
    const prev = filtersHintPrevSigRef.current;
    if (prev === filtersResultHintSig) {
      return;
    }
    if (prev === null) {
      filtersHintPrevSigRef.current = filtersResultHintSig;
      return;
    }

    filtersHintPrevSigRef.current = filtersResultHintSig;

    if (filtersResultHintHideRef.current != null) {
      window.clearTimeout(filtersResultHintHideRef.current);
      filtersResultHintHideRef.current = null;
    }
    setFiltersResultHint(null);

    const showTimer = window.setTimeout(() => {
      if (!window.matchMedia("(min-width: 1024px)").matches) {
        return;
      }
      setFiltersResultHint({
        key: Date.now(),
        count: filteredListCountHintRef.current,
        tab: hintActiveTabRef.current,
      });

      filtersResultHintHideRef.current = window.setTimeout(() => {
        setFiltersResultHint(null);
        filtersResultHintHideRef.current = null;
      }, 2600);
    }, 400);

    return () => {
      window.clearTimeout(showTimer);
      if (filtersResultHintHideRef.current != null) {
        window.clearTimeout(filtersResultHintHideRef.current);
        filtersResultHintHideRef.current = null;
      }
    };
  }, [filtersResultHintSig]);

  function toggleFilterCategory(slug: string) {
    const base = urlFiltersRef.current;
    if (tab === "organizations") {
      const current = base.orgCategorySlugs;
      const next = current.includes(slug) ?
        current.filter((s) => s !== slug)
      : [...current, slug];
      commitFilterPatch({ orgCategorySlugs: next });
      return;
    }
    const current = base.specCategorySlugs;
    const next = current.includes(slug) ?
      current.filter((s) => s !== slug)
    : [...current, slug];
    commitFilterPatch({ specCategorySlugs: next });
  }

  function setFilterBodyZones(next: string[]) {
    if (tab === "organizations") {
      commitFilterPatch({ orgBodyZoneSlugs: next });
      return;
    }
    commitFilterPatch({ specBodyZoneSlugs: next });
  }

  function resetAllFilters() {
    if (priceFilterDebounceRef.current != null) {
      clearTimeout(priceFilterDebounceRef.current);
      priceFilterDebounceRef.current = null;
    }
    const base = urlFiltersRef.current;
    const next = applySearchUrlPatch(base, {
      orgCategorySlugs: [],
      specCategorySlugs: [],
      orgBodyZoneSlugs: [],
      specBodyZoneSlugs: [],
      specialistGender: null,
      slotDay: null,
      slotTime: null,
      priceMinVnd: null,
      priceMaxVnd: null,
      sort: SEARCH_DIRECTORY_DEFAULT_SORT,
      radiusM: null,
      radiusLat: null,
      radiusLng: null,
    });
    commitUrlFilters(next);
  }

  const openFiltersDialog = () => {
    setFiltersOpen(true);
  };

  /**
   * Только «первичная» загрузка (нет данных в кэше RQ + идёт fetch).
   * Не `isPending && !data`: при refetch/фокуре окна нет бесконечного скелетона из‑за `!data`.
   * В v5: `isLoading` ≈ `isPending && isFetching`.
   */
  const orgListLoading =
    tab === "organizations" &&
    organizationsInfinite.isPending &&
    organizationsInfinite.isFetching;
  const specListLoading =
    tab === "specialists" &&
    specialistsInfinite.isPending &&
    specialistsInfinite.isFetching;
  const orgListError = tab === "organizations" && organizationsInfinite.isError;
  const specListError = tab === "specialists" && specialistsInfinite.isError;

  const rawListLoading = orgListLoading || specListLoading;
  const hasServerListData =
    (tab === "organizations" && organizations.length > 0) ||
    (tab === "specialists" && specialists.length > 0);
  /** Первичная загрузка без данных: плейсхолдер → по задержке скелетон (без пустой ленты между ними). */
  const showListSkeleton = useDelayedLoadingIndicator(
    rawListLoading && !hasServerListData,
    220,
  );

  const orgNextPageLoading =
    tab === "organizations" && organizationsInfinite.isFetchingNextPage;
  const specNextPageLoading =
    tab === "specialists" && specialistsInfinite.isFetchingNextPage;
  /** Без задержки: сразу под списком при подгрузке страницы (сеть/сервер), иначе микро-лагу без UI. */
  const showNextPageSkeleton =
    orgNextPageLoading || specNextPageLoading;

  /** Пусто по фильтрам: с сервера 0, или с сервера есть строки, но радиус (клиент) всё отсёк; слот + пусто — отдельный блок noSlotMatch. */
  const showSalonsEmptyFilterMessage =
    !orgListLoading &&
    organizations.length === 0 &&
    (hasActiveFilters || urlFilters.q.trim() !== "");
  const showSpecialistsEmptyFilterMessage =
    !specListLoading &&
    specialists.length === 0 &&
    (hasActiveFilters || urlFilters.q.trim() !== "");

  const catalogFiltersProps = useMemo((): CatalogFiltersProps => {
    return {
      showResetButton: hasActiveFilters,
      onResetFilters: resetAllFilters,
      selectedCategorySlugs: filterCategorySlugs,
      onToggleCategory: toggleFilterCategory,
      selectedBodyZoneSlugs: filterBodyZoneSlugs,
      bodyZoneOptions,
      onChangeBodyZoneSlugs: setFilterBodyZones,
      genderOptions: tab === "specialists" ? genderOptions : [],
      selectedGender: tab === "specialists" ? urlFilters.specialistGender : null,
      onSelectGender:
        tab === "specialists"
          ? (gender) => {
              commitFilterPatch({ specialistGender: gender });
            }
          : undefined,
      categoryOptions,
      priceFilter: priceFilterForDialog,
      slotTimeFilter: {
        value: slotPickValue,
        onChange: (next) => {
          commitFilterPatch({
            slotDay: next.day.trim() ? next.day : null,
            slotTime: next.time.trim() ? next.time : null,
          });
        },
        timeOptions: slotTimeOptionsStatic,
      },
      readOnlyVndLine: readOnlyOrgVndLine,
      showReadOnlyVndNote: readOnlyOrgVndLine != null,
      showPriceDataUnavailable:
        tab === "specialists" &&
        catalogFilterQuerySuccess &&
        !catalogFilterApi?.priceRangeVnd &&
        !hasPriceInListData &&
        specialists.length > 0,
      radiusMapFilter: {
        isActive: hasRadiusFilter,
        activeDetailLabel: radiusFilterDetailLabel,
        onSelectOnMap: () => {
          setFiltersOpen(false);
          const base = urlFiltersRef.current;
          const qs = buildSearchMapQueryString(base, { pickRadius: true });
          router.push(
            qs ? `/search/map?${qs}` : "/search/map?pickRadius=1",
          );
        },
      },
    };
  }, [
    hasActiveFilters,
    resetAllFilters,
    filterCategorySlugs,
    toggleFilterCategory,
    filterBodyZoneSlugs,
    bodyZoneOptions,
    setFilterBodyZones,
    tab,
    genderOptions,
    urlFilters.specialistGender,
    commitFilterPatch,
    categoryOptions,
    priceFilterForDialog,
    slotPickValue,
    slotTimeOptionsStatic,
    readOnlyOrgVndLine,
    catalogFilterQuerySuccess,
    catalogFilterApi?.priceRangeVnd,
    hasPriceInListData,
    specialists.length,
    hasRadiusFilter,
    radiusFilterDetailLabel,
    router,
  ]);

  const listPanel = (
    <div className="space-y-2.5" role="tabpanel">
      {orgListError || specListError ?
        <p className="text-center text-sm text-destructive" role="alert">
          {tSearch("listLoadError")}
        </p>
      : rawListLoading && !hasServerListData ?
        showListSkeleton ?
          <CursorPaginationDirectoryListSkeleton
            count={SEARCH_DIRECTORY_CURSOR_PAGE_SIZE}
          />
        : <div className="min-h-80 w-full shrink-0" aria-hidden />
      : tab === "organizations" ?
        <>
          {showSalonsEmptyFilterMessage ?
            <Empty className="rounded-2xl bg-surface-light/50 py-4">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchX aria-hidden />
                </EmptyMedia>
                <EmptyDescription className="max-w-md font-medium text-foreground">
                  {tSearch("noSalonsForFilters")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          : null}
          {hasActiveSlotFilter &&
          !orgListLoading &&
          organizations.length > 0 &&
          displayOrganizations.length === 0 ?
            <Empty className="rounded-2xl bg-surface-light/50 py-4">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CalendarClock aria-hidden />
                </EmptyMedia>
                <EmptyTitle className="text-muted-foreground">
                  {tSearch("noSlotMatch")}
                </EmptyTitle>
                <EmptyDescription className="max-w-md text-xs leading-relaxed">
                  {tSearch("slotFilterClientNote")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          : null}
          <div className="space-y-2.5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0 xl:grid-cols-2">
            {displayOrganizations.map((o) => {
              const card = organizationCardSeedFromApi(o, listingNow);
              return (
                <OrganizationCard
                  key={card.id}
                  {...card}
                  imageAlt={card.name}
                  profileHref={`/organizations/${o.id}`}
                  slotGroups={slotGroupsFromSeed(card.slotGroups, tSlots, {
                    locale,
                    maxGroups: 5,
                    now: listingNow,
                  })}
                />
              );
            })}
            {showNextPageSkeleton ?
              Array.from({ length: SEARCH_DIRECTORY_CURSOR_PAGE_SIZE }, (_, skeletonIndex) => (
                <CursorPaginationDirectoryCardSkeleton
                  key={`org-next-page-${skeletonIndex}`}
                />
              ))
            : null}
          </div>
          <div
            ref={orgSentinelRef}
            className="h-2 w-full shrink-0"
            aria-hidden
          />
        </>
      : <>
          {showSpecialistsEmptyFilterMessage ?
            <Empty className="rounded-2xl bg-surface-light/50 py-4">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchX aria-hidden />
                </EmptyMedia>
                <EmptyDescription className="max-w-md font-medium text-foreground">
                  {tSearch("noSpecialistsForFilters")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          : null}
          {hasActiveSlotFilter &&
          !specListLoading &&
          specialists.length > 0 &&
          displaySpecialists.length === 0 ?
            <Empty className="rounded-2xl bg-surface-light/50 py-4">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CalendarClock aria-hidden />
                </EmptyMedia>
                <EmptyTitle className="text-muted-foreground">
                  {tSearch("noSlotMatch")}
                </EmptyTitle>
                <EmptyDescription className="max-w-md text-xs leading-relaxed">
                  {tSearch("slotFilterClientNote")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          : null}
          <div className="space-y-2.5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0 xl:grid-cols-2">
            {displaySpecialists.map((s) => {
              const card = specialistCardSeedFromApi(s, listingNow);
              return (
                <SpecialistCard
                  key={card.id}
                  {...card}
                  imageAlt={card.name}
                  profileHref={`/specialists/${s.id}`}
                  slotGroups={slotGroupsFromSeed(card.slotGroups, tSlots, {
                    locale,
                    maxGroups: 5,
                    now: listingNow,
                  })}
                />
              );
            })}
            {showNextPageSkeleton ?
              Array.from({ length: SEARCH_DIRECTORY_CURSOR_PAGE_SIZE }, (_, skeletonIndex) => (
                <CursorPaginationDirectoryCardSkeleton
                  key={`spec-next-page-${skeletonIndex}`}
                />
              ))
            : null}
          </div>
          <div
            ref={specSentinelRef}
            className="h-2 w-full shrink-0"
            aria-hidden
          />
        </>
      }
    </div>
  );

  const renderSearchTabButtons = (layout: "mobile" | "desktop") =>
    SEARCH_TABS.map(({ id, labelKey }) => {
      const selected = tab === id;
      return (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={selected}
          className={cn(
            motion.interactivePressStrong,
            "rounded-full py-2.5 text-sm font-medium transition-colors",
            layout === "mobile" ?
              "min-w-0 flex-1 text-center"
            : "flex h-9 min-w-0 w-full items-center justify-center px-2 text-center",
            selected
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => {
            const base = urlFiltersRef.current;
            if (id === "organizations") {
              commitUrlFilters(
                applySearchUrlPatch(base, {
                  tab: id,
                  priceMinVnd: null,
                  priceMaxVnd: null,
                }),
              );
            } else {
              commitUrlFilters(applySearchUrlPatch(base, { tab: id }));
            }
          }}
        >
          {tSearch(labelKey)}
        </button>
      );
    });

  return (
    <div className={consumerPageRootClass("min-h-0 flex-1")}>
      <main className={consumerPageMainClass("space-y-3")}>
        <HomeScreenHeader
          title={tSearch("title")}
          avatarAlt={homeUser.firstName}
          avatarFallback={homeUser.firstName.slice(0, 2).toUpperCase()}
        />

        <div
          className="flex rounded-full bg-muted p-1 lg:hidden"
          role="tablist"
          aria-label={tSearch("tablistAria")}
        >
          {renderSearchTabButtons("mobile")}
        </div>

        <div className="flex items-center">
          <div
            className="hidden h-11 max-w-[318px] shrink-0 grid-cols-2 rounded-full bg-muted p-1 lg:mr-4 lg:grid lg:w-full lg:items-center"
            role="tablist"
            aria-label={tSearch("tablistAria")}
          >
            {renderSearchTabButtons("desktop")}
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="min-w-0 flex-1">
            <Input
              value={qDraft}
              onChange={(e) => {
                const v = e.target.value;
                setQDraft(v);
                if (qDebounceRef.current != null) {
                  clearTimeout(qDebounceRef.current);
                }
                qDebounceRef.current = setTimeout(() => {
                  qDebounceRef.current = null;
                  commitUrlFilters(
                    applySearchUrlPatch(urlFiltersRef.current, { q: v }),
                  );
                }, 350);
              }}
              placeholder={tSearch("searchPlaceholder")}
              autoComplete="off"
              aria-label={tSearch("searchAria")}
              startAdornment={<SearchIcon className="size-4" aria-hidden />}
              className="h-11 w-full rounded-full border-0 bg-surface-light"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            tone="light"
            className="relative size-11 shrink-0 rounded-full p-0 lg:hidden"
            aria-label={tSearch("filtersAria")}
            aria-expanded={filtersOpen}
            onClick={() => {
              openFiltersDialog();
            }}
          >
            {hasActiveFilters ? (
              <span
                className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary"
                aria-hidden
              />
            ) : null}
            <SlidersHorizontal
              className="size-5 text-muted-foreground"
              aria-hidden
            />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                tone="light"
                className="size-11 shrink-0 rounded-full p-0"
                aria-label={tSearch("sortLabel")}
              >
                <ArrowUpDown
                  className="size-5 text-muted-foreground"
                  aria-hidden
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="bottom"
              className="w-[min(18rem,calc(100vw-2rem))]"
            >
              {(
                [
                  { value: "popularity" as const, key: "sortPopularity" as const },
                  ...(showRecommendedSortOption ?
                    [
                      {
                        value: "recommended" as const,
                        key: "sortRecommended" as const,
                      },
                    ]
                  : []),
                  { value: "newest" as const, key: "sortNewest" as const },
                  { value: "price_asc" as const, key: "sortPriceAsc" as const },
                  {
                    value: "price_desc" as const,
                    key: "sortPriceDesc" as const,
                  },
                  { value: "rating" as const, key: "sortRating" as const },
                ] as const
              ).map(({ value, key }) => {
                const selected = selectSortValue === value;
                return (
                  <DropdownMenuItem
                    key={value}
                    onSelect={() => {
                      applySearchSort(value);
                    }}
                    className={cn(
                      selected && "bg-muted font-medium",
                    )}
                  >
                    {tSearch(key)}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            variant="secondary"
            tone="light"
            className="size-11 shrink-0 rounded-full p-0"
            aria-label={tSearch("mapAria")}
            asChild
          >
            <Link href={mapHref}>
              <MapIcon className="size-5 text-muted-foreground" aria-hidden />
            </Link>
          </Button>
          </div>
        </div>

        <div className="lg:flex lg:items-stretch lg:gap-4">
          <SearchFiltersSidebar
            ariaLabel={tSearch("filtersAria")}
            hint={
              filtersResultHint ?
                <SearchFiltersResultHint
                  animateKey={filtersResultHint.key}
                  count={filtersResultHint.count}
                  tab={filtersResultHint.tab}
                />
              : null
            }
          >
            <CatalogFilters
              {...catalogFiltersProps}
              presentation="panel"
            />
          </SearchFiltersSidebar>
          <div className="min-w-0 flex-1">{listPanel}</div>
        </div>
      </main>

      <HomeBottomNav activeId="search" />
      <CatalogFilters
        {...catalogFiltersProps}
        presentation="dialog"
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
      />
    </div>
  );
}

