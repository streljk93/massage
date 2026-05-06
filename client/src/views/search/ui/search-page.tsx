"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { vnNoonUtcForCalendarYmd } from "@/shared/lib/datetime/vn-listing-datetime";
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
import { HomeBottomNav, HomeScreenHeader } from "@/widgets/home";
import {
  createBrowserSdkClient,
  directoryGetCatalogFilterOptions,
  personalizationGetRecommendations,
  type OrganizationsListResponse,
  type SpecialistsListResponse,
} from "@/shared/api";
import { useCursorPaginationSentinel } from "@/shared/lib/use-cursor-pagination-sentinel";
import { useDelayedLoadingIndicator } from "@/shared/lib/use-delayed-loading-indicator";
import { useListingClock } from "@/shared/lib/use-listing-clock";
import { CursorPaginationDirectoryListSkeleton } from "@/shared/ui/cursor-pagination-directory-card-skeleton";
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
import { SEARCH_TABS } from "@/shared/lib/search-tab";
import { CATALOG_MAJOR_CATEGORY_SLUG } from "@/shared/config/catalog-major-category";
import { trackSearchFiltersApplied } from "@/shared/lib/personalization/personalization-track";
import {
  applySearchUrlPatch,
  buildSearchMapQueryString,
  buildSearchQueryString,
  parseSearchUrlFilters,
  type SearchUrlFilters,
} from "../lib/search-url-filters";
import {
  buildSearchSlotDayOptions,
  buildSearchSlotTimeOptions,
} from "../lib/search-slot-time-options";
import {
  CatalogFiltersDialog,
  priceSliderStep,
  specialistListPriceBounds,
  type CatalogSlotTimeFilterValue,
} from "@/entities/catalog";

export type SearchPageClientProps = {
  initialOrganizationsPage: OrganizationsListResponse | null;
  initialSpecialistsPage: SpecialistsListResponse | null;
  initialOrgListPrefetch: SearchOrganizationsListPrefetchSnapshot;
  initialSpecListPrefetch: SearchSpecialistsListPrefetchSnapshot;
};

export function SearchPageClient({
  initialOrganizationsPage,
  initialSpecialistsPage,
  initialOrgListPrefetch,
  initialSpecListPrefetch,
}: SearchPageClientProps) {
  const tSearch = useTranslations("search");
  const tSlots = useTranslations("slots");
  const format = useFormatter();
  const locale = useLocale() as AppLocale;
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? "";
  const listingNow = useListingClock();
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
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname],
  );

  useLayoutEffect(() => {
    if (searchParams.get("filters") !== "1") {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- открыть фильтры по `filters=1` при возврате с карты; сразу убираем параметр из URL
    setDraftOrgCategorySlugs(urlFilters.orgCategorySlugs);
    setDraftSpecCategorySlugs(urlFilters.specCategorySlugs);
    setDraftOrgBodyZoneSlugs(urlFilters.orgBodyZoneSlugs);
    setDraftSpecBodyZoneSlugs(urlFilters.specBodyZoneSlugs);
    setDraftSpecialistGender(urlFilters.specialistGender);
    setDraftSlotPick({
      day: urlFilters.slotDay ?? "",
      time: urlFilters.slotTime ?? "",
    });
    setDraftSpecPriceRange(null);
    setDraftResetRequested(false);
    setFiltersOpen(true);
    const next = new URLSearchParams(searchParams.toString());
    next.delete("filters");
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [searchParams, pathname, router, urlFilters]);

  const urlFiltersRef = useRef(urlFilters);

  useEffect(() => {
    urlFiltersRef.current = urlFilters;
  }, [urlFilters]);

  const [qDraft, setQDraft] = useState(urlFilters.q);
  const qDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draftOrgCategorySlugs, setDraftOrgCategorySlugs] = useState<string[]>([]);
  const [draftSpecCategorySlugs, setDraftSpecCategorySlugs] = useState<string[]>([]);
  const [draftOrgBodyZoneSlugs, setDraftOrgBodyZoneSlugs] = useState<string[]>([]);
  const [draftSpecBodyZoneSlugs, setDraftSpecBodyZoneSlugs] = useState<string[]>([]);
  const [draftSpecialistGender, setDraftSpecialistGender] = useState<
    "male" | "female" | null
  >(null);
  const [draftSlotPick, setDraftSlotPick] = useState<CatalogSlotTimeFilterValue>({
    day: "",
    time: "",
  });
  const [draftSpecPriceRange, setDraftSpecPriceRange] = useState<[number, number] | null>(
    null,
  );
  const [draftResetRequested, setDraftResetRequested] = useState(false);

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
  const dialogCategorySlugs =
    tab === "organizations" ? draftOrgCategorySlugs : draftSpecCategorySlugs;
  const dialogBodyZoneSlugs =
    tab === "organizations" ? draftOrgBodyZoneSlugs : draftSpecBodyZoneSlugs;

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
  const slotDayOptions = useMemo(
    () =>
      buildSearchSlotDayOptions(listingNow, (calendarDate) =>
        format.dateTime(vnNoonUtcForCalendarYmd(calendarDate), {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
      ),
    [listingNow, format],
  );

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

  const { data: catalogFilterApi, isSuccess: catalogFilterQuerySuccess } =
    useQuery({
      queryKey: ["directoryCatalogFilter", tab, locale] as const,
      enabled: filtersOpen,
      retry: 1,
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
    const fromApi = catalogFilterApi?.categories;
    if (fromApi && fromApi.length > 0) {
      return fromApi;
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

  const priceFilterForDialog = useMemo(() => {
    if (tab !== "specialists") {
      return null;
    }
    if (specialistPriceExtent == null) {
      return null;
    }
    const ext = specialistPriceExtent;
    const storedMin = urlFilters.priceMinVnd;
    const storedMax = urlFilters.priceMaxVnd;
    const fromApplied: [number, number] = [
      Math.max(
        ext.min,
        Math.min(storedMin ?? ext.min, ext.max),
      ),
      Math.max(
        ext.min,
        Math.min(storedMax ?? ext.max, ext.max),
      ),
    ];
    const value = draftSpecPriceRange ?? fromApplied;
    return {
      extent: ext,
      value,
      step: priceSliderStep(ext.min, ext.max),
      onValueChange: (v: [number, number]) => {
        setDraftResetRequested(false);
        setDraftSpecPriceRange(v);
      },
      formatValue: (n: number) =>
        format.number(n, {
          style: "currency",
          currency: "VND",
          maximumFractionDigits: 0,
        }),
    };
  }, [
    tab,
    specialistPriceExtent,
    urlFilters.priceMinVnd,
    urlFilters.priceMaxVnd,
    draftSpecPriceRange,
    format,
  ]);

  const readOnlyOrgVndLine = useMemo(() => {
    if (tab !== "organizations") {
      return null;
    }
    const r = catalogFilterApi?.priceRangeVnd;
    if (r == null) {
      return null;
    }
    const fmt = (n: number) =>
      format.number(n, {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      });
    return { min: fmt(r.min), max: fmt(r.max) };
  }, [tab, catalogFilterApi?.priceRangeVnd, format]);

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

  const hasActiveFilters =
    filterCategorySlugs.length > 0 ||
    filterBodyZoneSlugs.length > 0 ||
    (tab === "specialists" && urlFilters.specialistGender != null) ||
    hasActivePriceFilter ||
    hasActiveSlotFilter ||
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

  function toggleFilterCategory(slug: string) {
    setDraftResetRequested(false);
    if (tab === "organizations") {
      setDraftOrgCategorySlugs((current) =>
        current.includes(slug) ?
          current.filter((s) => s !== slug)
        : [...current, slug],
      );
    } else {
      setDraftSpecCategorySlugs((current) =>
        current.includes(slug) ?
          current.filter((s) => s !== slug)
        : [...current, slug],
      );
    }
  }

  function setFilterBodyZones(next: string[]) {
    setDraftResetRequested(false);
    if (tab === "organizations") {
      setDraftOrgBodyZoneSlugs(next);
    } else {
      setDraftSpecBodyZoneSlugs(next);
    }
  }

  function resetAllFilters() {
    setDraftResetRequested(true);
    setDraftSlotPick({ day: "", time: "" });
    // Сброс категорий делаем для обеих вкладок, чтобы legacy-вход с `category`
    // (из главной) не оставлял скрытый фильтр во второй вкладке.
    setDraftOrgCategorySlugs([]);
    setDraftSpecCategorySlugs([]);
    if (tab === "organizations") {
      setDraftOrgBodyZoneSlugs([]);
    } else {
      setDraftSpecBodyZoneSlugs([]);
      setDraftSpecialistGender(null);
      if (specialistPriceExtent != null) {
        setDraftSpecPriceRange([
          specialistPriceExtent.min,
          specialistPriceExtent.max,
        ]);
      } else {
        setDraftSpecPriceRange(null);
      }
    }
  }

  const openFiltersDialog = () => {
    setDraftOrgCategorySlugs(urlFiltersRef.current.orgCategorySlugs);
    setDraftSpecCategorySlugs(urlFiltersRef.current.specCategorySlugs);
    setDraftOrgBodyZoneSlugs(urlFiltersRef.current.orgBodyZoneSlugs);
    setDraftSpecBodyZoneSlugs(urlFiltersRef.current.specBodyZoneSlugs);
    setDraftSpecialistGender(urlFiltersRef.current.specialistGender);
    setDraftSlotPick({
      day: urlFiltersRef.current.slotDay ?? "",
      time: urlFiltersRef.current.slotTime ?? "",
    });
    setDraftSpecPriceRange(null);
    setDraftResetRequested(false);
    setFiltersOpen(true);
  };

  const applyDraftFilters = () => {
    const base = urlFiltersRef.current;
    let next = applySearchUrlPatch(base, {
      orgCategorySlugs: draftOrgCategorySlugs,
      specCategorySlugs: draftSpecCategorySlugs,
      orgBodyZoneSlugs: draftOrgBodyZoneSlugs,
      specBodyZoneSlugs: draftSpecBodyZoneSlugs,
      specialistGender: draftSpecialistGender,
      slotDay: draftSlotPick.day && draftSlotPick.time ? draftSlotPick.day : null,
      slotTime:
        draftSlotPick.day && draftSlotPick.time ? draftSlotPick.time : null,
    });
    if (tab === "specialists" && specialistPriceExtent != null) {
      const v = draftSpecPriceRange;
      next = applySearchUrlPatch(
        next,
        v == null || (v[0] <= specialistPriceExtent.min && v[1] >= specialistPriceExtent.max) ?
          { priceMinVnd: null, priceMaxVnd: null }
        : { priceMinVnd: v[0], priceMaxVnd: v[1] },
      );
    }
    if (draftResetRequested) {
      next = applySearchUrlPatch(next, {
        sort: SEARCH_DIRECTORY_DEFAULT_SORT,
        radiusM: null,
        radiusLat: null,
        radiusLng: null,
      });
    }
    commitUrlFilters(next);
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

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface-background">
      <main className="mx-auto w-full max-w-lg flex-1 space-y-3 px-4 pt-3 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <HomeScreenHeader
          title={tSearch("title")}
          avatarAlt={homeUser.firstName}
          avatarFallback={homeUser.firstName.slice(0, 2).toUpperCase()}
        />

        <div
          className="flex rounded-full bg-muted p-1"
          role="tablist"
          aria-label={tSearch("tablistAria")}
        >
          {SEARCH_TABS.map(({ id, labelKey }) => {
            const selected = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={cn(
                  motion.interactivePressStrong,
                  "min-w-0 flex-1 rounded-full py-2.5 text-center text-sm font-medium transition-colors",
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
          })}
        </div>

        <div className="flex items-center gap-2">
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
            className="relative size-11 shrink-0 rounded-full p-0"
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

        <div className="space-y-2.5" role="tabpanel">
          {orgListError || specListError ?
            <p className="text-center text-sm text-destructive" role="alert">
              {tSearch("listLoadError")}
            </p>
          : rawListLoading && !hasServerListData ?
            showListSkeleton ?
              <CursorPaginationDirectoryListSkeleton count={6} />
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
                <CursorPaginationDirectoryListSkeleton
                  count={displayOrganizations.length > 0 ? 2 : 6}
                />
              : null}
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
                <CursorPaginationDirectoryListSkeleton
                  count={displaySpecialists.length > 0 ? 2 : 6}
                />
              : null}
              <div
                ref={specSentinelRef}
                className="h-2 w-full shrink-0"
                aria-hidden
              />
            </>
          }
        </div>
      </main>

      <HomeBottomNav activeId="search" />
      <CatalogFiltersDialog
        open={filtersOpen}
        onApplyFilters={applyDraftFilters}
        onOpenChange={(open) => {
          setFiltersOpen(open);
        }}
        selectedCategorySlugs={dialogCategorySlugs}
        onToggleCategory={toggleFilterCategory}
        selectedBodyZoneSlugs={dialogBodyZoneSlugs}
        bodyZoneOptions={bodyZoneOptions}
        onChangeBodyZoneSlugs={setFilterBodyZones}
        genderOptions={tab === "specialists" ? genderOptions : []}
        selectedGender={tab === "specialists" ? draftSpecialistGender : null}
        onSelectGender={
          tab === "specialists"
            ? (gender) => {
                setDraftResetRequested(false);
                setDraftSpecialistGender(gender);
              }
            : undefined
        }
        onResetFilters={resetAllFilters}
        categoryOptions={categoryOptions}
        priceFilter={priceFilterForDialog}
        slotTimeFilter={{
          value: draftSlotPick,
          onChange: (next) => {
            setDraftResetRequested(false);
            setDraftSlotPick(next);
          },
          dayOptions: slotDayOptions,
          timeOptions: slotTimeOptionsStatic,
        }}
        readOnlyVndLine={readOnlyOrgVndLine}
        showReadOnlyVndNote={readOnlyOrgVndLine != null}
        showPriceDataUnavailable={
          tab === "specialists" &&
          catalogFilterQuerySuccess &&
          !catalogFilterApi?.priceRangeVnd &&
          !hasPriceInListData &&
          specialists.length > 0
        }
        radiusMapFilter={{
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
        }}
      />
    </div>
  );
}
