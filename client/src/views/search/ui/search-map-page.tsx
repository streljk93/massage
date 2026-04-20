"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Link, useRouter } from "@/app/i18n/navigation";
import {
  Slider,
  type SliderHandle,
  type SliderSlide,
} from "@/shared/ui/slider";
import { HomeBottomNav } from "@/widgets/home";
import { SearchMapResultCard } from "@/widgets/search-map/ui/search-map-result-card";
import { topSalons, topSpecialists } from "@/widgets/home/lib/mock-data";
import { cn, motion } from "@/shared/lib";
import {
  parseSearchTab,
  SEARCH_TABS,
  searchTabQueryValue,
  type SearchTab,
} from "../lib/search-tab";

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
}: {
  tab: SearchTab;
  onTabChange: (id: SearchTab) => void;
}) {
  const tSearch = useTranslations("search");
  const tMap = useTranslations("searchMap");
  const list = tab === "organizations" ? topSalons : topSpecialists;
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const sliderRef = useRef<SliderHandle>(null);

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
            className={cardGlass}
          />
        ),
      })),
    [list],
  );

  return (
    <div className="relative min-h-0 w-full flex-1">
      <div className="absolute inset-0 z-0 [&_.leaflet-control-container]:z-[410]">
        <SearchResultsLeafletMap
          items={mapItems}
          selectedIndex={activeCardIndex}
          onMarkerSelect={onMarkerSelect}
        />
      </div>

      {/* Табы и закрытие — те же размеры табов, что на /search */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[420] flex items-center gap-1 pt-4 pl-3 pr-2"
      >
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

      <div className="pointer-events-none absolute right-0 bottom-0 left-0 z-[420] mx-auto max-w-lg px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto">
          <Slider
            ref={sliderRef}
            slides={slides}
            slideClassName="!min-w-[min(276px,calc(100vw-2rem))] max-w-[276px]"
            showDots
            dotsAriaLabel={tMap("sliderDotsAria")}
            onActiveIndexChange={onSlideIndexChange}
            className="pb-1"
          />
        </div>
      </div>
    </div>
  );
}

export function SearchMapPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tab = parseSearchTab(searchParams.get("tab"));

  const onTabChange = useCallback(
    (id: SearchTab) => {
      router.replace(`/search/map?tab=${searchTabQueryValue(id)}`);
    },
    [router],
  );

  return (
    <div className="flex min-h-screen flex-col bg-surface-background">
      <div className="flex min-h-0 flex-1 flex-col">
        <SearchMapInteractiveLayer
          key={tab}
          tab={tab}
          onTabChange={onTabChange}
        />
      </div>

      <HomeBottomNav activeId="search" />
    </div>
  );
}
