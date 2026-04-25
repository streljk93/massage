"use client";

import { useMemo } from "react";
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
import { slotGroupsFromSeed } from "@/widgets/home/lib/slot-groups-from-seed";
import { useListingClock } from "@/shared/lib/use-listing-clock";
import { searchTabQueryValue } from "@/shared/lib/search-tab";
import { cn } from "@/shared/lib";

const LIST_LIMIT = 3;

type HomeForYouSectionProps = {
  className?: string;
};

export function HomeForYouSection({ className }: HomeForYouSectionProps) {
  const t = useTranslations("homeForYou");
  const tSlots = useTranslations("slots");
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken ?? "";
  const recommendationsEnabled =
    sessionStatus === "authenticated" && accessToken.length > 0;
  const locale = useLocale() as AppLocale;
  const listingNow = useListingClock();

  const client = useMemo(
    () => createBrowserSdkClient(accessToken, { locale }),
    [accessToken, locale],
  );

  const { data, isError } = useQuery({
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
    enabled: recommendationsEnabled,
    staleTime: 120_000,
  });

  if (isError) {
    return null;
  }
  /** Пока нет ответа (или query выключен) — не рисуем заголовок/скелетон, иначе мигание. */
  if (data == null) {
    return null;
  }
  if (!data.personalizationReady) {
    return null;
  }
  const { specialists, organizations } = data;
  if (specialists.length === 0 && organizations.length === 0) {
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
      <div className="space-y-2.5">
        {specialists.map((s) => {
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
        {organizations.map((o) => {
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
      </div>
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
