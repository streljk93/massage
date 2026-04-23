"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Map as MapIcon, Search as SearchIcon, SlidersHorizontal } from "lucide-react";
import { OrganizationCard } from "@/entities/organizations";
import { SpecialistCard } from "@/entities/specialists";
import type { AppLocale } from "@/app/i18n/routing";
import { Link, usePathname, useRouter } from "@/app/i18n/navigation";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { HomeBottomNav, HomeScreenHeader } from "@/widgets/home";
import {
  createBrowserSdkClient,
  directoryGetCatalogFilterOptions,
  type OrganizationsListResponse,
  type SpecialistsListResponse,
} from "@/shared/api";
import { useCursorPaginationSentinel } from "@/shared/lib/use-cursor-pagination-sentinel";
import { CursorPaginationDirectoryListSkeleton } from "@/shared/ui/cursor-pagination-directory-card-skeleton";
import {
  organizationCardSeedFromApi,
  specialistCardSeedFromApi,
} from "@/widgets/home/lib/directory-cards-from-api";
import { homeUser } from "@/widgets/home/lib/mock-data";
import { slotGroupsFromSeed } from "@/widgets/home/lib/slot-groups-from-seed";
import { cn, motion } from "@/shared/lib";
import {
  type SearchOrganizationsListPrefetchSnapshot,
  type SearchSpecialistsListPrefetchSnapshot,
  useSearchOrganizationsCursorInfiniteQuery,
  useSearchSpecialistsCursorInfiniteQuery,
} from "../lib/use-search-directory-cursor-infinite-queries";
import type {
  SearchOrganizationsListApiFilters,
  SearchSpecialistsListApiFilters,
} from "../lib/search-directory-list-api-filters";
import { SEARCH_TABS } from "../lib/search-tab";
import {
  applySearchUrlPatch,
  buildSearchQueryString,
  parseSearchUrlFilters,
  type SearchUrlFilters,
} from "../lib/search-url-filters";
import {
  CatalogFiltersDialog,
  priceSliderStep,
  specialistListPriceBounds,
} from "@/entities/catalog";

/** Запись цены в URL (и запрос списка) не чаще этого интервала при движении слайдера. */
const SEARCH_PRICE_URL_DEBOUNCE_MS = 450;

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
  const listingNow = useMemo(() => new Date(), []);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const urlFilters = useMemo(
    () => parseSearchUrlFilters(searchParams),
    [searchParams],
  );
  const tab = urlFilters.tab;

  const replaceUrlFilters = useCallback(
    (next: SearchUrlFilters) => {
      const qs = buildSearchQueryString(next);
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname],
  );

  const urlFiltersRef = useRef(urlFilters);

  useEffect(() => {
    urlFiltersRef.current = urlFilters;
  }, [urlFilters]);

  const [qDraft, setQDraft] = useState(urlFilters.q);
  const qDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [priceDraft, setPriceDraft] = useState<[number, number] | null>(null);
  const priceDraftRef = useRef<[number, number] | null>(null);
  const priceDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Синхронизация черновика строки поиска с URL (назад/вперёд, обновление query не из поля).
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- qDraft дублирует URL между debounce-событиями
    setQDraft(urlFilters.q);
  }, [urlFilters.q]);

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- слайдер после обновления price* в URL
    setPriceDraft(null);
    priceDraftRef.current = null;
  }, [urlFilters.priceMinVnd, urlFilters.priceMaxVnd]);

  useEffect(() => {
    return () => {
      if (qDebounceRef.current != null) {
        clearTimeout(qDebounceRef.current);
      }
      if (priceDebounceRef.current != null) {
        clearTimeout(priceDebounceRef.current);
      }
    };
  }, []);

  const commitUrlFilters = useCallback(
    (next: SearchUrlFilters) => {
      if (qDebounceRef.current != null) {
        clearTimeout(qDebounceRef.current);
        qDebounceRef.current = null;
      }
      if (priceDebounceRef.current != null) {
        clearTimeout(priceDebounceRef.current);
        priceDebounceRef.current = null;
      }
      setPriceDraft(null);
      priceDraftRef.current = null;
      replaceUrlFilters(next);
    },
    [replaceUrlFilters],
  );

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

  const orgApiFilters = useMemo((): SearchOrganizationsListApiFilters => {
    return {
      q: urlFilters.q,
      categorySlugs: urlFilters.orgCategorySlugs,
    };
  }, [urlFilters.q, urlFilters.orgCategorySlugs]);

  const specApiFilters = useMemo((): SearchSpecialistsListApiFilters => {
    return {
      q: urlFilters.q,
      categorySlugs: urlFilters.specCategorySlugs,
      priceMinVnd: urlFilters.priceMinVnd,
      priceMaxVnd: urlFilters.priceMaxVnd,
    };
  }, [
    urlFilters.q,
    urlFilters.specCategorySlugs,
    urlFilters.priceMinVnd,
    urlFilters.priceMaxVnd,
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

  const priceSpecialistBounds = useMemo(
    () => specialistListPriceBounds(specialists),
    [specialists],
  );

  const specialistPriceExtent = useMemo(() => {
    return (
      catalogFilterApi?.priceRangeVnd ?? priceSpecialistBounds ?? null
    );
  }, [catalogFilterApi?.priceRangeVnd, priceSpecialistBounds]);

  const specialistPriceExtentRef = useRef<typeof specialistPriceExtent>(null);
  useEffect(() => {
    specialistPriceExtentRef.current = specialistPriceExtent;
  }, [specialistPriceExtent]);

  const priceFilterForDialog = useMemo(() => {
    if (tab !== "specialists") {
      return null;
    }
    if (specialistPriceExtent == null) {
      return null;
    }
    const ext = specialistPriceExtent;
    const stored = filterPriceByTab.specialists;
    const fromUrl: [number, number] = [
      Math.max(
        ext.min,
        Math.min(stored?.min ?? ext.min, ext.max),
      ),
      Math.max(
        ext.min,
        Math.min(stored?.max ?? ext.max, ext.max),
      ),
    ];
    const value = priceDraft ?? fromUrl;
    return {
      extent: ext,
      value,
      step: priceSliderStep(ext.min, ext.max),
      onValueChange: (v: [number, number]) => {
        setPriceDraft(v);
        priceDraftRef.current = v;
        if (priceDebounceRef.current != null) {
          clearTimeout(priceDebounceRef.current);
        }
        priceDebounceRef.current = setTimeout(() => {
          priceDebounceRef.current = null;
          const base = urlFiltersRef.current;
          const extent = specialistPriceExtentRef.current;
          if (!extent) {
            return;
          }
          const next =
            v[0] <= extent.min && v[1] >= extent.max ?
              applySearchUrlPatch(base, {
                priceMinVnd: null,
                priceMaxVnd: null,
              })
            : applySearchUrlPatch(base, {
                priceMinVnd: v[0],
                priceMaxVnd: v[1],
              });
          replaceUrlFilters(next);
        }, SEARCH_PRICE_URL_DEBOUNCE_MS);
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
    filterPriceByTab.specialists,
    priceDraft,
    format,
    replaceUrlFilters,
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

  const hasActiveFilters =
    filterCategorySlugs.length > 0 || hasActivePriceFilter;

  const mapHref = useMemo(() => {
    const qs = buildSearchQueryString(urlFilters);
    return qs ? `/search/map?${qs}` : "/search/map";
  }, [urlFilters]);

  function toggleFilterCategory(slug: string) {
    const base = urlFiltersRef.current;
    if (tab === "organizations") {
      const current = base.orgCategorySlugs;
      const next = current.includes(slug) ?
          current.filter((s) => s !== slug)
        : [...current, slug];
      commitUrlFilters(applySearchUrlPatch(base, { orgCategorySlugs: next }));
    } else {
      const current = base.specCategorySlugs;
      const next = current.includes(slug) ?
          current.filter((s) => s !== slug)
        : [...current, slug];
      commitUrlFilters(applySearchUrlPatch(base, { specCategorySlugs: next }));
    }
  }

  function resetAllFilters() {
    const base = urlFiltersRef.current;
    if (tab === "organizations") {
      commitUrlFilters(applySearchUrlPatch(base, { orgCategorySlugs: [] }));
    } else {
      commitUrlFilters(
        applySearchUrlPatch(base, {
          specCategorySlugs: [],
          priceMinVnd: null,
          priceMaxVnd: null,
        }),
      );
    }
  }

  const orgListLoading =
    tab === "organizations" &&
    organizationsInfinite.isPending &&
    !organizationsInfinite.data;
  const specListLoading =
    tab === "specialists" &&
    specialistsInfinite.isPending &&
    !specialistsInfinite.data;
  const orgListError = tab === "organizations" && organizationsInfinite.isError;
  const specListError = tab === "specialists" && specialistsInfinite.isError;

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
                  commitUrlFilters(
                    applySearchUrlPatch(urlFiltersRef.current, {
                      tab: id,
                      orgCategorySlugs: [],
                      specCategorySlugs: [],
                      priceMinVnd: null,
                      priceMaxVnd: null,
                    }),
                  );
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
              placeholder={
                tab === "organizations"
                  ? tSearch("placeholderSalon")
                  : tSearch("placeholderSpecialist")
              }
              autoComplete="off"
              aria-label={
                tab === "organizations"
                  ? tSearch("ariaSalon")
                  : tSearch("ariaSpecialist")
              }
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
              setFiltersOpen(true);
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
          : orgListLoading || specListLoading ?
            <CursorPaginationDirectoryListSkeleton count={6} />
          : tab === "organizations" ?
            <>
              {organizations.map((o) => {
                const card = organizationCardSeedFromApi(o);
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
              {organizationsInfinite.isFetchingNextPage ?
                <CursorPaginationDirectoryListSkeleton count={6} />
              : null}
              <div
                ref={orgSentinelRef}
                className="h-2 w-full shrink-0"
                aria-hidden
              />
            </>
          : <>
              {specialists.map((s) => {
                const card = specialistCardSeedFromApi(s);
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
              {specialistsInfinite.isFetchingNextPage ?
                <CursorPaginationDirectoryListSkeleton count={6} />
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
        onOpenChange={(open) => {
          if (!open) {
            if (priceDebounceRef.current != null) {
              clearTimeout(priceDebounceRef.current);
              priceDebounceRef.current = null;
            }
            const extent = specialistPriceExtentRef.current;
            const draft = priceDraftRef.current;
            if (extent && draft) {
              const v = draft;
              replaceUrlFilters(
                applySearchUrlPatch(
                  urlFiltersRef.current,
                  v[0] <= extent.min && v[1] >= extent.max ?
                    {
                      priceMinVnd: null,
                      priceMaxVnd: null,
                    }
                  : {
                      priceMinVnd: v[0],
                      priceMaxVnd: v[1],
                    },
                ),
              );
            }
            setPriceDraft(null);
            priceDraftRef.current = null;
          }
          setFiltersOpen(open);
        }}
        selectedCategorySlugs={filterCategorySlugs}
        onToggleCategory={toggleFilterCategory}
        onResetFilters={resetAllFilters}
        categoryOptions={categoryOptions}
        priceFilter={priceFilterForDialog}
        readOnlyVndLine={readOnlyOrgVndLine}
        showReadOnlyVndNote={readOnlyOrgVndLine != null}
        showPriceDataUnavailable={
          tab === "specialists" &&
          catalogFilterQuerySuccess &&
          !catalogFilterApi?.priceRangeVnd &&
          !hasPriceInListData &&
          specialists.length > 0
        }
      />
    </div>
  );
}
