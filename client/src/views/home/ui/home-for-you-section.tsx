"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { organizationCardSeedFromApi } from "@/entities/organizations";
import { specialistCardSeedFromApi } from "@/entities/specialists";
import { OrganizationCard } from "@/entities/organizations";
import { SpecialistCard } from "@/entities/specialists";
import type { AppLocale } from "@/app/i18n/routing";
import { Link } from "@/app/i18n/navigation";
import { Button } from "@/shared/ui/button";
import {
  createBrowserSdkClient,
  personalizationGetRecommendations,
} from "@/shared/api";
import { useMemo } from "react";
import { slotGroupsFromSeed } from "@/widgets/home/lib/slot-groups-from-seed";
import { searchTabQueryValue } from "@/shared/lib/search-tab";
import { cn } from "@/shared/lib";

const LIST_LIMIT = 3;

type HomeForYouSectionProps = {
  className?: string;
};

export function HomeForYouSection({ className }: HomeForYouSectionProps) {
  const t = useTranslations("homeForYou");
  const tSlots = useTranslations("slots");
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? "";
  const locale = useLocale() as AppLocale;
  const listingNow = useMemo(() => new Date(), []);

  const client = useMemo(
    () => createBrowserSdkClient(accessToken, { locale }),
    [accessToken, locale],
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ["personalization", "recommendations", accessToken, locale] as const,
    queryFn: async () => {
      const { data: res, error } = await personalizationGetRecommendations({
        client,
        query: { locale, listLimit: LIST_LIMIT },
      });
      if (error) {
        throw new Error("personalization recommendations failed");
      }
      return res;
    },
    staleTime: 120_000,
  });

  const specialists = data?.specialists ?? [];
  const organizations = data?.organizations ?? [];
  if (isError || (data == null && !isLoading)) {
    return null;
  }
  if (!isLoading && specialists.length === 0 && organizations.length === 0) {
    return null;
  }

  return (
    <section
      className={cn("space-y-2.5", className)}
      aria-labelledby="home-for-you-heading"
    >
      <h2
        id="home-for-you-heading"
        className="font-heading text-lg font-semibold tracking-tight"
      >
        {t("title")}
      </h2>
      {isLoading ?
        <div className="space-y-2.5" aria-hidden>
          <div className="h-32 animate-pulse rounded-2xl bg-muted" />
          <div className="h-32 animate-pulse rounded-2xl bg-muted" />
        </div>
      : <div className="space-y-2.5">
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
        </div>
      }
      <Button
        variant="secondary"
        tone="light"
        className="h-11 w-full rounded-full font-medium"
        asChild
      >
        <Link href={`/search?tab=${searchTabQueryValue("specialists")}`}>
          {t("seeAll")}
        </Link>
      </Button>
    </section>
  );
}
