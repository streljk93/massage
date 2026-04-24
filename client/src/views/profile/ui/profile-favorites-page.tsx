"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useMemo } from "react";
import type { AppLocale } from "@/app/i18n/routing";
import { usePathname, useRouter } from "@/app/i18n/navigation";
import {
  parseFavoritePairKey,
  readGuestFavoriteKeyList,
} from "@/entities/favorites";
import {
  OrganizationCard,
  organizationCardSeedFromApi,
} from "@/entities/organizations";
import {
  SpecialistCard,
  specialistCardSeedFromApi,
} from "@/entities/specialists";
import {
  createBrowserSdkClient,
  favoritesListOrganizationsListing,
  favoritesListSpecialistsListing,
  organizationsGetById,
  specialistsGetById,
} from "@/shared/api";
import { CursorPaginationDirectoryListSkeleton } from "@/shared/ui/cursor-pagination-directory-card-skeleton";
import { cn, motion } from "@/shared/lib";
import { slotGroupsFromSeed } from "@/widgets/home/lib/slot-groups-from-seed";
import {
  SEARCH_TABS,
  parseSearchTab,
  searchTabQueryValue,
  type SearchTab,
} from "@/shared/lib/search-tab";
import { ProfileSubpageShell } from "./profile-subpage-shell";

export function ProfileFavoritesPage() {
  const t = useTranslations("profileFavorites");
  const tSearch = useTranslations("search");
  const tSlots = useTranslations("slots");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = parseSearchTab(searchParams.get("tab"));
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken ?? "";
  const userId = session?.user?.id;
  const isAuthed =
    status === "authenticated" && Boolean(accessToken && userId);
  const listingNow = useMemo(() => new Date(), []);

  const setTab = (id: SearchTab) => {
    const qs = new URLSearchParams(searchParams.toString());
    qs.set("tab", searchTabQueryValue(id));
    const s = qs.toString();
    router.replace(s ? `${pathname}?${s}` : pathname);
  };

  const orgQuery = useQuery({
    queryKey: ["favorites", "organizations-listing", userId, locale],
    enabled: isAuthed && tab === "organizations",
    queryFn: async () => {
      const client = createBrowserSdkClient(accessToken, { locale });
      const res = await favoritesListOrganizationsListing({
        client,
        query: { locale },
      });
      if (res.error || !res.data) {
        throw new Error("favorites_org_listing");
      }
      return res.data.organizations;
    },
  });

  const specQuery = useQuery({
    queryKey: ["favorites", "specialists-listing", userId, locale],
    enabled: isAuthed && tab === "specialists",
    queryFn: async () => {
      const client = createBrowserSdkClient(accessToken, { locale });
      const res = await favoritesListSpecialistsListing({
        client,
        query: { locale },
      });
      if (res.error || !res.data) {
        throw new Error("favorites_spec_listing");
      }
      return res.data.specialists;
    },
  });

  const guestOrgQuery = useQuery({
    queryKey: ["favorites", "guest", "organizations-listing", locale] as const,
    enabled: status === "unauthenticated" && tab === "organizations",
    queryFn: async () => {
      const client = createBrowserSdkClient("", { locale });
      const orgIds = readGuestFavoriteKeyList()
        .map((k) => parseFavoritePairKey(k))
        .filter(
          (p): p is NonNullable<typeof p> =>
            p != null && p.targetKind === "organization",
        )
        .map((p) => p.targetId);
      const rows = await Promise.all(
        orgIds.map(async (id) => {
          const res = await organizationsGetById({ client, path: { id } });
          if (res.error || !res.data) {
            return null;
          }
          return res.data;
        }),
      );
      return rows.filter((r): r is NonNullable<typeof r> => r != null);
    },
  });

  const guestSpecQuery = useQuery({
    queryKey: ["favorites", "guest", "specialists-listing", locale] as const,
    enabled: status === "unauthenticated" && tab === "specialists",
    queryFn: async () => {
      const client = createBrowserSdkClient("", { locale });
      const specIds = readGuestFavoriteKeyList()
        .map((k) => parseFavoritePairKey(k))
        .filter(
          (p): p is NonNullable<typeof p> =>
            p != null && p.targetKind === "specialist",
        )
        .map((p) => p.targetId);
      const rows = await Promise.all(
        specIds.map(async (id) => {
          const res = await specialistsGetById({ client, path: { id } });
          if (res.error || !res.data) {
            return null;
          }
          return res.data;
        }),
      );
      return rows.filter((r): r is NonNullable<typeof r> => r != null);
    },
  });

  const activeError =
    tab === "organizations" ?
      isAuthed ?
        orgQuery.isError
      : guestOrgQuery.isError
    : isAuthed ?
      specQuery.isError
    : guestSpecQuery.isError;
  const activeLoading =
    tab === "organizations" ?
      isAuthed ?
        orgQuery.isLoading
      : guestOrgQuery.isLoading
    : isAuthed ?
      specQuery.isLoading
    : guestSpecQuery.isLoading;
  const organizations =
    (isAuthed ? orgQuery.data : guestOrgQuery.data) ?? [];
  const specialists =
    (isAuthed ? specQuery.data : guestSpecQuery.data) ?? [];

  return (
    <ProfileSubpageShell
      title={t("title")}
      className="space-y-3 pt-3"
    >
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
              onClick={() => setTab(id)}
            >
              {tSearch(labelKey)}
            </button>
          );
        })}
      </div>

      <div className="space-y-2.5" role="tabpanel">
        {activeError ?
          <p className="text-center text-sm text-destructive" role="alert">
            {t("loadError")}
          </p>
        : activeLoading ?
          <CursorPaginationDirectoryListSkeleton count={6} />
        : tab === "organizations" ?
          organizations.length === 0 ?
            <p className="rounded-2xl border border-border/60 bg-card px-4 py-6 text-center text-sm text-muted-foreground">
              {t("emptyOrganizations")}
            </p>
          : organizations.map((o) => {
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
        : specialists.length === 0 ?
          <p className="rounded-2xl border border-border/60 bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            {t("emptySpecialists")}
          </p>
        : specialists.map((s) => {
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
    </ProfileSubpageShell>
  );
}
