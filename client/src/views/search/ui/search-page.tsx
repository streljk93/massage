"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Map as MapIcon, Search as SearchIcon, SlidersHorizontal } from "lucide-react";
import { OrganizationCard } from "@/entities/organizations";
import { SpecialistCard } from "@/entities/specialists";
import type { AppLocale } from "@/app/i18n/routing";
import { Link, useRouter } from "@/app/i18n/navigation";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { HomeBottomNav, HomeScreenHeader } from "@/widgets/home";
import {
  createBrowserSdkClient,
  directoryGetCatalogFilterOptions,
  type OrganizationsListResponse,
  type SpecialistsListResponse,
} from "@/shared/api";
import {
  organizationCardSeedFromApi,
  specialistCardSeedFromApi,
} from "@/widgets/home/lib/directory-cards-from-api";
import { homeUser } from "@/widgets/home/lib/mock-data";
import { slotGroupsFromSeed } from "@/widgets/home/lib/slot-groups-from-seed";
import { cn, motion } from "@/shared/lib";
import {
  type SearchTab,
  parseSearchTab,
  SEARCH_TABS,
  searchTabQueryValue,
} from "../lib/search-tab";
import {
  CatalogFiltersDialog,
  priceSliderStep,
  specialistHasPriceInRange,
  specialistListPriceBounds,
} from "@/entities/catalog";

function matchesListQuery(
  q: string,
  item: { name: string; metaLine: string; servicesLine: string },
) {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  return (
    item.name.toLowerCase().includes(n) ||
    item.metaLine.toLowerCase().includes(n) ||
    item.servicesLine.toLowerCase().includes(n)
  );
}

function matchesCategoryFilter(
  item: { categories: { slug: string }[] },
  slugs: ReadonlySet<string>,
) {
  if (slugs.size === 0) return true;
  return item.categories.some((c) => slugs.has(c.slug));
}

export type SearchPageClientProps = {
  initialOrganizations: OrganizationsListResponse["organizations"] | null;
  initialSpecialists: SpecialistsListResponse["specialists"] | null;
};

export function SearchPageClient({
  initialOrganizations,
  initialSpecialists,
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
  const tab = parseSearchTab(searchParams.get("tab"));
  const [listQuery, setListQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterSlugsByTab, setFilterSlugsByTab] = useState<
    Record<SearchTab, string[]>
  >({ organizations: [], specialists: [] });
  const [filterPriceByTab, setFilterPriceByTab] = useState<
    Record<SearchTab, { min: number; max: number } | null>
  >({ organizations: null, specialists: null });
  const filterCategorySlugs = filterSlugsByTab[tab];

  const organizations = useMemo(
    () => initialOrganizations ?? [],
    [initialOrganizations],
  );
  const specialists = useMemo(
    () => initialSpecialists ?? [],
    [initialSpecialists],
  );

  const filterCategorySet = useMemo(
    () => new Set(filterCategorySlugs),
    [filterCategorySlugs],
  );

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

  const priceFilterForDialog = useMemo(() => {
    if (tab !== "specialists") {
      return null;
    }
    if (specialistPriceExtent == null) {
      return null;
    }
    const ext = specialistPriceExtent;
    const stored = filterPriceByTab.specialists;
    const value: [number, number] = [
      Math.max(
        ext.min,
        Math.min(stored?.min ?? ext.min, ext.max),
      ),
      Math.max(
        ext.min,
        Math.min(stored?.max ?? ext.max, ext.max),
      ),
    ];
    return {
      extent: ext,
      value,
      step: priceSliderStep(ext.min, ext.max),
      onValueChange: (v: [number, number]) => {
        if (v[0] <= ext.min && v[1] >= ext.max) {
          setFilterPriceByTab((f) => ({ ...f, specialists: null }));
        } else {
          setFilterPriceByTab((f) => ({
            ...f,
            specialists: { min: v[0], max: v[1] },
          }));
        }
      },
      formatValue: (n: number) =>
        format.number(n, {
          style: "currency",
          currency: "VND",
          maximumFractionDigits: 0,
        }),
    };
  }, [tab, specialistPriceExtent, filterPriceByTab.specialists, format]);

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

  function toggleFilterCategory(slug: string) {
    setFilterSlugsByTab((f) => {
      const current = f[tab];
      const next = current.includes(slug)
        ? current.filter((s) => s !== slug)
        : [...current, slug];
      return { ...f, [tab]: next };
    });
  }

  function resetAllFilters() {
    setFilterSlugsByTab((f) => ({ ...f, [tab]: [] }));
    setFilterPriceByTab((f) => ({ ...f, specialists: null }));
  }

  const filteredSalons = useMemo(
    () =>
      organizations.filter((o) =>
        matchesListQuery(listQuery, {
          name: o.name,
          metaLine: o.metaLine,
          servicesLine: o.servicesLine,
        }),
      ).filter((o) => matchesCategoryFilter(o, filterCategorySet)),
    [listQuery, organizations, filterCategorySet],
  );

  const filteredSpecialists = useMemo(
    () =>
      specialists
        .filter((s) =>
          matchesListQuery(listQuery, {
            name: s.name,
            metaLine: s.metaLine,
            servicesLine: s.servicesLine,
          }),
        )
        .filter((s) => matchesCategoryFilter(s, filterCategorySet))
        .filter((s) => {
          if (specialistPriceExtent == null) return true;
          const pr = filterPriceByTab.specialists;
          if (pr == null) return true;
          if (
            pr.min <= specialistPriceExtent.min &&
            pr.max >= specialistPriceExtent.max
          ) {
            return true;
          }
          return specialistHasPriceInRange(s, pr);
        }),
    [
      listQuery,
      specialists,
      filterCategorySet,
      specialistPriceExtent,
      filterPriceByTab.specialists,
    ],
  );

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
                  router.replace(`/search?tab=${searchTabQueryValue(id)}`);
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
              value={listQuery}
              onChange={(e) => setListQuery(e.target.value)}
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
            <Link href={`/search/map?tab=${searchTabQueryValue(tab)}`}>
              <MapIcon className="size-5 text-muted-foreground" aria-hidden />
            </Link>
          </Button>
        </div>

        <div className="space-y-2.5" role="tabpanel">
          {tab === "organizations"
            ? filteredSalons.map((o) => {
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
              })
            : filteredSpecialists.map((s) => {
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
        </div>

        <Button
          variant="secondary"
          tone="light"
          className="h-10 w-full rounded-full font-medium"
          type="button"
        >
          {tSearch("seeAll")}
        </Button>
      </main>

      <HomeBottomNav activeId="search" />
      <CatalogFiltersDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
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
