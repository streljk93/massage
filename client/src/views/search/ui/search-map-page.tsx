"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { Range, Root, Thumb, Track } from "@radix-ui/react-slider";
import { LocateFixed, X } from "lucide-react";
import { Link, useRouter } from "@/app/i18n/navigation";
import type {
  OrganizationsListResponse,
  SpecialistsListResponse,
} from "@/shared/api";
import { HomeBottomNav } from "@/widgets/home";
import { Button } from "@/shared/ui/button";
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
  type SearchTab,
} from "@/shared/lib/search-tab";
import {
  applySearchUrlPatch,
  buildSearchMapQueryString,
  buildSearchQueryString,
  parseSearchUrlFilters,
  type SearchUrlFilters,
} from "../lib/search-url-filters";
import {
  directoryOrganizationHasFreeSlotAt,
  directorySpecialistHasFreeSlotAt,
} from "@/shared/lib/directory-matches-free-slot";
import {
  radiusLogStepFromMeters,
  radiusMetersFromLogStep,
} from "@/widgets/search-map/lib/radius-meters-log-slider";

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

const PHU_QUOC: [number, number] = [10.223, 103.968];

function SearchMapInteractiveLayer({
  tab,
  onTabChange,
  organizationItems,
  specialistItems,
  urlFilters,
  mapMode,
  onRadiusApply,
}: {
  tab: SearchTab;
  onTabChange: (id: SearchTab) => void;
  organizationItems: SearchMapListItem[];
  specialistItems: SearchMapListItem[];
  urlFilters: SearchUrlFilters;
  mapMode: "default" | "radiusPick";
  onRadiusApply?: (p: {
    center: [number, number];
    radiusM: number;
  }) => void;
}) {
  const tSearch = useTranslations("search");
  const tMap = useTranslations("searchMap");
  const format = useFormatter();
  const isRadiusPick = mapMode === "radiusPick";
  const list =
    tab === "organizations" ? organizationItems : specialistItems;
  const [activeCardIndex, setActiveCardIndex] = useState<number | null>(null);
  const initialRadiusM = useMemo(() => {
    if (
      urlFilters.radiusM != null &&
      urlFilters.radiusLat != null &&
      urlFilters.radiusLng != null
    ) {
      return urlFilters.radiusM;
    }
    return 2000;
  }, [urlFilters.radiusM, urlFilters.radiusLat, urlFilters.radiusLng]);
  const [radiusMeters, setRadiusMeters] = useState(initialRadiusM);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const radiusState = useMemo(
    () =>
      mapCenter == null ? null
      : { center: mapCenter, radiusM: radiusMeters },
    [mapCenter, radiusMeters],
  );
  const mapFlyToRef = useRef<((p: [number, number]) => void) | null>(null);
  const { userPosition, requestFromUserGesture } = useUserGeolocation();

  const closeHref = useMemo(() => {
    const qs = buildSearchQueryString(urlFilters);
    return qs ? `/search?${qs}` : "/search";
  }, [urlFilters]);

  const radiusMapCenter = useMemo((): [number, number] => {
    if (
      urlFilters.radiusM != null &&
      urlFilters.radiusLat != null &&
      urlFilters.radiusLng != null
    ) {
      return [urlFilters.radiusLat, urlFilters.radiusLng];
    }
    return PHU_QUOC;
  }, [urlFilters.radiusLat, urlFilters.radiusLng, urlFilters.radiusM]);

  const onMapFlyReady = useCallback(
    (flyTo: (p: [number, number]) => void) => {
      mapFlyToRef.current = flyTo;
    },
    [],
  );

  /**
   * Пины **не** зависят от радиуса — иначе при смене радиуса React перерисовывает маркеры/кластер
   * и визуально «мигают». Зона поиска показывается кругом на карте (`MapRadiusMetersOverlay`).
   */
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

  useEffect(() => {
    setActiveCardIndex((prev) => {
      if (list.length === 0) return null;
      if (prev == null) return null;
      return Math.min(prev, list.length - 1);
    });
  }, [list.length]);

  const onMarkerSelect = useCallback((index: number) => {
    setActiveCardIndex(index);
  }, []);

  const onMapBackgroundClick = useCallback(() => {
    setActiveCardIndex(null);
  }, []);

  const noopMarkerSelect = useCallback(() => {}, []);

  const selectedListItem =
    activeCardIndex != null && list.length > 0
      ? list[Math.min(list.length - 1, activeCardIndex)]
      : null;

  const radiusReadout = useMemo(() => {
    const m = radiusMeters;
    if (m >= 1000) {
      return tMap("radiusKilometers", {
        km: format.number(m / 1000, { maximumFractionDigits: 1 }),
      });
    }
    return tMap("radiusMeters", { meters: format.number(m, { maximumFractionDigits: 0 }) });
  }, [format, radiusMeters, tMap]);

  const onRadiusMapGeometry = useCallback(
    (p: { center: [number, number]; radiusM: number }) => {
      setMapCenter(p.center);
    },
    [],
  );

  return (
    <div className="relative h-full min-h-0 w-full flex-1 overflow-hidden">
      <div className="absolute inset-0 z-0 [&_.leaflet-control-container]:z-[25]">
        <SearchResultsLeafletMap
          userPosition={userPosition}
          onMapFlyReady={onMapFlyReady}
          items={mapItems}
          selectedIndex={activeCardIndex}
          onMarkerSelect={isRadiusPick ? noopMarkerSelect : onMarkerSelect}
          onMapBackgroundClick={isRadiusPick ? undefined : onMapBackgroundClick}
          userLocationAriaLabel={tMap("userLocationAria")}
          radiusPickerMode={isRadiusPick}
          radiusMapCenter={radiusMapCenter}
          radiusMapInitialZoom={14}
          radiusPickerMeters={isRadiusPick ? radiusMeters : 2000}
          onRadiusSelectionChange={isRadiusPick ? onRadiusMapGeometry : undefined}
        />
      </div>

      {isRadiusPick ?
        <div className="pointer-events-none absolute right-2 top-24 bottom-40 z-50 flex w-11 items-center justify-center pr-0.5 sm:right-3">
          <div className="pointer-events-auto flex h-[min(48vh,280px)] flex-col items-center justify-center rounded-2xl border border-white/25 bg-card/55 py-2 pl-1 pr-0.5 shadow-sm backdrop-blur-sm supports-[backdrop-filter]:bg-card/40">
            <Root
              orientation="vertical"
              className="relative flex h-full w-9 min-h-0 touch-none select-none items-center"
              min={0}
              max={1000}
              step={1}
              value={[radiusLogStepFromMeters(radiusMeters)]}
              onValueChange={([s]) => {
                setRadiusMeters(radiusMetersFromLogStep(s ?? 0));
              }}
              aria-label={tMap("radiusSliderAria")}
            >
              <Track className="relative h-full w-2 grow overflow-hidden rounded-full bg-zinc-200/80">
                <Range className="absolute w-full rounded-full bg-primary/85" />
              </Track>
              <Thumb
                className={cn(
                  "block size-4 cursor-grab rounded-full border border-border/40 bg-white shadow-md",
                  "shadow-black/10 transition-transform hover:ring-2 hover:ring-primary/25",
                  "focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none",
                  "active:cursor-grabbing",
                )}
              />
            </Root>
          </div>
        </div>
      : null}

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
            href={closeHref}
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
          {isRadiusPick ?
            <Button
              type="button"
              className="h-11 w-full rounded-full text-base font-medium"
              disabled={mapCenter == null}
              onClick={() => {
                if (radiusState == null || onRadiusApply == null) {
                  return;
                }
                onRadiusApply(radiusState);
              }}
            >
              {`${tMap("applyRadius")} ${radiusReadout}`}
            </Button>
          : list.length === 0 ?
            <p
              className="rounded-2xl border border-white/20 bg-card/80 px-3 py-3 text-center text-sm text-muted-foreground backdrop-blur-md supports-[backdrop-filter]:bg-card/60"
              role="status"
            >
              {tMap("emptyResults")}
            </p>
          : activeCardIndex != null && selectedListItem != null ?
            <div className="w-full min-w-0">
              <SearchMapResultCard
                key={selectedListItem.id}
                name={selectedListItem.name}
                imageSrc={selectedListItem.imageSrc}
                imageAlt={selectedListItem.name}
                rating={selectedListItem.rating}
                metaLine={selectedListItem.metaLine}
                profileHref={
                  tab === "organizations"
                    ? `/organizations/${selectedListItem.id}`
                    : `/specialists/${selectedListItem.id}`
                }
                className={cardGlass}
              />
            </div>
          : null
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

  const pickRadius = searchParams.get("pickRadius") === "1";
  const tab = parseSearchTab(searchParams.get("tab"));
  const urlFilters = useMemo(
    () => parseSearchUrlFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const mapSlotNow = useMemo(() => new Date(), []);

  const organizationItems = useMemo(() => {
    let list = initialOrganizations ?? [];
    const d = urlFilters.slotDay;
    const tm = urlFilters.slotTime;
    if (d && tm) {
      list = list.filter((o) =>
        directoryOrganizationHasFreeSlotAt(o, d, tm, mapSlotNow),
      );
    }
    return searchMapOrganizationsFromApi(list);
  }, [initialOrganizations, urlFilters.slotDay, urlFilters.slotTime, mapSlotNow]);

  const specialistItems = useMemo(() => {
    let list = initialSpecialists ?? [];
    const d = urlFilters.slotDay;
    const tm = urlFilters.slotTime;
    if (d && tm) {
      list = list.filter((s) =>
        directorySpecialistHasFreeSlotAt(s, d, tm, mapSlotNow),
      );
    }
    return searchMapSpecialistsFromApi(list);
  }, [initialSpecialists, urlFilters.slotDay, urlFilters.slotTime, mapSlotNow]);

  const onTabChange = useCallback(
    (id: SearchTab) => {
      const current = parseSearchUrlFilters(
        new URLSearchParams(searchParams.toString()),
      );
      const next =
        id === "organizations" ?
          applySearchUrlPatch(current, {
            tab: id,
            priceMinVnd: null,
            priceMaxVnd: null,
          })
        : applySearchUrlPatch(current, { tab: id });
      const qs = pickRadius ?
        buildSearchMapQueryString(next, { pickRadius: true })
      : buildSearchQueryString(next);
      if (qs) {
        router.replace(`/search/map?${qs}`);
      } else {
        router.replace(pickRadius ? "/search/map?pickRadius=1" : "/search/map");
      }
    },
    [pickRadius, router, searchParams],
  );

  const onRadiusApply = useCallback(
    (p: { center: [number, number]; radiusM: number }) => {
      const current = parseSearchUrlFilters(
        new URLSearchParams(searchParams.toString()),
      );
      const next = applySearchUrlPatch(current, {
        radiusM: p.radiusM,
        radiusLat: p.center[0],
        radiusLng: p.center[1],
      });
      const qs = buildSearchQueryString(next, { filtersOneShot: true });
      router.push(qs ? `/search?${qs}` : "/search");
    },
    [router, searchParams],
  );

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-surface-background">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <SearchMapInteractiveLayer
          key={pickRadius ? `radius-${tab}` : tab}
          tab={tab}
          onTabChange={onTabChange}
          urlFilters={urlFilters}
          mapMode={pickRadius ? "radiusPick" : "default"}
          onRadiusApply={pickRadius ? onRadiusApply : undefined}
          organizationItems={organizationItems}
          specialistItems={specialistItems}
        />
      </div>

      <HomeBottomNav activeId="search" />
    </div>
  );
}
