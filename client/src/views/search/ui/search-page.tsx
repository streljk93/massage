"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Map, Search as SearchIcon, SlidersHorizontal } from "lucide-react";
import { OrganizationCard } from "@/entities/organizations";
import { SpecialistCard } from "@/entities/specialists";
import { Link, useRouter } from "@/app/i18n/navigation";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { HomeBottomNav, HomeScreenHeader } from "@/widgets/home";
import type {
  OrganizationsListResponse,
  SpecialistsListResponse,
} from "@/shared/api";
import {
  organizationCardSeedFromApi,
  specialistCardSeedFromApi,
} from "@/widgets/home/lib/directory-cards-from-api";
import { homeUser } from "@/widgets/home/lib/mock-data";
import { slotGroupsFromSeed } from "@/widgets/home/lib/slot-groups-from-seed";
import { cn, motion } from "@/shared/lib";
import {
  parseSearchTab,
  SEARCH_TABS,
  searchTabQueryValue,
} from "../lib/search-tab";

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
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = parseSearchTab(searchParams.get("tab"));
  const [listQuery, setListQuery] = useState("");

  const organizations = initialOrganizations ?? [];
  const specialists = initialSpecialists ?? [];

  const filteredSalons = useMemo(
    () =>
      organizations.filter((o) =>
        matchesListQuery(listQuery, {
          name: o.name,
          metaLine: o.metaLine,
          servicesLine: o.servicesLine,
        }),
      ),
    [listQuery, organizations],
  );

  const filteredSpecialists = useMemo(
    () =>
      specialists.filter((s) =>
        matchesListQuery(listQuery, {
          name: s.name,
          metaLine: s.metaLine,
          servicesLine: s.servicesLine,
        }),
      ),
    [listQuery, specialists],
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
            className="size-11 shrink-0 rounded-full p-0"
            aria-label={tSearch("filtersAria")}
          >
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
              <Map className="size-5 text-muted-foreground" aria-hidden />
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
                    slotGroups={slotGroupsFromSeed(card.slotGroups, tSlots)}
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
                    slotGroups={slotGroupsFromSeed(card.slotGroups, tSlots)}
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
    </div>
  );
}
