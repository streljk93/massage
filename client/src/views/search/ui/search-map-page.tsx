"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { LocateFixed, X } from "lucide-react";
import { Link, useRouter } from "@/app/i18n/navigation";
import {
  Slider,
  type SliderHandle,
  type SliderSlide,
} from "@/shared/ui/slider";
import type {
  OrganizationsListResponse,
  SpecialistsListResponse,
} from "@/shared/api";
import { HomeBottomNav } from "@/widgets/home";
import {
  SearchMapResultCard,
  useUserGeolocation,
} from "@/widgets/search-map";
import {
  type SearchMapListItem,
  searchMapOrganizationsFromApi,
  searchMapSpecialistsFromApi,
} from "@/widgets/home/lib/search-map-list-from-api";
import { cn, motion } from "@/shared/lib";
import {
  parseSearchTab,
  SEARCH_TABS,
  searchTabQueryValue,
  type SearchTab,
} from "../lib/search-tab";
import {
  applySearchUrlPatch,
  buildSearchQueryString,
  parseSearchUrlFilters,
} from "../lib/search-url-filters";

const SearchResultsLeafletMap = dynamic(
  () =>
    import("@/widgets/search-map/ui/search-results-leaflet-map").then((m) => ({
      default: m.SearchResultsLeafletMap,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex size-full min-h-[280px] items-center justify-center bg-muted/60" />
    ),
  },
);

const cardGlass =
  "border border-white/25 bg-card/75 backdrop-blur-md supports-[backdrop-filter]:bg-card/55";

function SearchMapInteractiveLayer({
  tab,
  onTabChange,
  organizationItems,
  specialistItems,
}: {
  tab: SearchTab;
  onTabChange: (id: SearchTab) => void;
  organizationItems: SearchMapListItem[];
  specialistItems: SearchMapListItem[];
}) {
  const tSearch = useTranslations("search");
  const tMap = useTranslations("searchMap");
  const list =
    tab === "organizations" ? organizationItems : specialistItems;
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const sliderRef = useRef<SliderHandle>(null);
  const mapFlyToRef = useRef<((p: [number, number]) => void) | null>(null);
  const { userPosition, requestFromUserGesture } = useUserGeolocation();

  const onMapFlyReady = useCallback(
    (flyTo: (p: [number, number]) => void) => {
      mapFlyToRef.current = flyTo;
    },
    [],
  );

  const mapItems = useMemo(
    () =>
      list.map((item) => ({
        id: item.id,
        lat: item.lat,
        lng: item.lng,
        imageSrc: item.imageSrc,
        name: item.name,
        rating: item.rating,
      })),
    [list],
  );

  const onMarkerSelect = useCallback((index: number) => {
    setActiveCardIndex(index);
    sliderRef.current?.scrollToIndex(index);
  }, []);

  const onSlideIndexChange = useCallback((index: number) => {
    setActiveCardIndex(index);
  }, []);

  const slides: SliderSlide[] = useMemo(
    () =>
      list.map((item) => ({
        id: item.id,
        content: (
          <SearchMapResultCard
            name={item.name}
            imageSrc={item.imageSrc}
            imageAlt={item.name}
            rating={item.rating}
            metaLine={item.metaLine}
            profileHref={
              tab === "organizations"
                ? `/organizations/${item.id}`
                : `/specialists/${item.id}`
            }
            className={cardGlass}
          />
        ),
      })),
    [list, tab],
  );

  return (
    <div className="relative h-full min-h-0 w-full flex-1 overflow-hidden">
      <div className="absolute inset-0 z-0 [&_.leaflet-control-container]:z-[25]">
        <SearchResultsLeafletMap
          userPosition={userPosition}
          onMapFlyReady={onMapFlyReady}
          items={mapItems}
          selectedIndex={activeCardIndex}
          onMarkerSelect={onMarkerSelect}
          userLocationAriaLabel={tMap("userLocationAria")}
        />
      </div>

      {/* Табы и закрытие — как на /search: внутри max-w-lg + px-4 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 pt-3">
        <div className="pointer-events-none mx-auto flex w-full max-w-lg items-center gap-1 px-4">
          <div className="pointer-events-auto flex min-w-0 flex-1 items-center justify-center px-1">
            <div
              className="flex w-full min-w-0 rounded-full bg-muted p-1"
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
                      onTabChange(id);
                    }}
                  >
                    {tSearch(labelKey)}
                  </button>
                );
              })}
            </div>
          </div>
          <Link
            href={`/search?tab=${searchTabQueryValue(tab)}`}
            aria-label={tMap("closeAria")}
            className={cn(
              motion.interactivePressStrong,
              "pointer-events-auto inline-flex size-10 shrink-0 items-center justify-center rounded-full border-0 bg-neutral-700 p-0 text-neutral-50 outline-none hover:bg-neutral-600 focus-visible:ring-3 focus-visible:ring-ring/50",
            )}
          >
            <X className="size-4 shrink-0" aria-hidden />
          </Link>
        </div>
      </div>

      <div className="pointer-events-none absolute right-0 bottom-0 left-0 z-40 mx-auto max-w-lg px-4 pb-[calc(5.75rem+env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto mb-1.5 flex justify-end">
          <button
            type="button"
            className={cn(
              motion.interactivePressStrong,
              "inline-flex max-w-[min(100%,18rem)] items-center justify-center gap-2 rounded-full bg-card px-3 py-2.5 text-sm font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50",
            )}
            onClick={() => {
              const fly = mapFlyToRef.current;
              if (userPosition && fly) {
                fly(userPosition);
              }
              requestFromUserGesture((p) => {
                mapFlyToRef.current?.(p);
              });
            }}
          >
            <LocateFixed className="size-5 shrink-0" aria-hidden />
            <span>{tMap("locateMeLabel")}</span>
          </button>
        </div>
        <div className="pointer-events-auto">
          {list.length > 0 ?
            <Slider
              ref={sliderRef}
              slides={slides}
              slideClassName="!min-w-[min(276px,calc(100vw-2rem))] max-w-[276px]"
              showDots
              dotsAriaLabel={tMap("sliderDotsAria")}
              onActiveIndexChange={onSlideIndexChange}
              className="pb-1"
            />
          : <p
              className="rounded-2xl border border-white/20 bg-card/80 px-3 py-3 text-center text-sm text-muted-foreground backdrop-blur-md supports-[backdrop-filter]:bg-card/60"
              role="status"
            >
              {tMap("emptyResults")}
            </p>
          }
        </div>
      </div>
    </div>
  );
}

export type SearchMapPageClientProps = {
  initialOrganizations: OrganizationsListResponse["organizations"] | null;
  initialSpecialists: SpecialistsListResponse["specialists"] | null;
};

export function SearchMapPageClient({
  initialOrganizations,
  initialSpecialists,
}: SearchMapPageClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tab = parseSearchTab(searchParams.get("tab"));

  const organizationItems = useMemo(
    () => searchMapOrganizationsFromApi(initialOrganizations ?? undefined),
    [initialOrganizations],
  );
  const specialistItems = useMemo(
    () => searchMapSpecialistsFromApi(initialSpecialists ?? undefined),
    [initialSpecialists],
  );

  const onTabChange = useCallback(
    (id: SearchTab) => {
      const current = parseSearchUrlFilters(
        new URLSearchParams(searchParams.toString()),
      );
      const next = applySearchUrlPatch(current, {
        tab: id,
        orgCategorySlugs: [],
        specCategorySlugs: [],
        priceMinVnd: null,
        priceMaxVnd: null,
      });
      const qs = buildSearchQueryString(next);
      router.replace(qs ? `/search/map?${qs}` : "/search/map");
    },
    [router, searchParams],
  );

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-surface-background">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <SearchMapInteractiveLayer
          key={tab}
          tab={tab}
          onTabChange={onTabChange}
          organizationItems={organizationItems}
          specialistItems={specialistItems}
        />
      </div>

      <HomeBottomNav activeId="search" />
    </div>
  );
}
