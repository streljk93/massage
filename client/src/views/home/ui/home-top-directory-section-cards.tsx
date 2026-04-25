"use client";

import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/app/i18n/routing";
import {
  OrganizationCard,
  organizationCardSeedFromApi,
} from "@/entities/organizations";
import {
  SpecialistCard,
  specialistCardSeedFromApi,
} from "@/entities/specialists";
import type { OrganizationsListResponse, SpecialistsListResponse } from "@/shared/api";
import { useListingClock } from "@/shared/lib/use-listing-clock";
import { slotGroupsFromSeed } from "@/widgets/home/lib/slot-groups-from-seed";

type SpecialistList = SpecialistsListResponse["specialists"];
type OrganizationList = OrganizationsListResponse["organizations"];

export function HomeTopSpecialistCards({ list }: { list: SpecialistList }) {
  const tSlots = useTranslations("slots");
  const locale = useLocale() as AppLocale;
  const now = useListingClock();

  return (
    <div className="space-y-2.5">
      {list.map((s) => {
        const card = specialistCardSeedFromApi(s, now);
        return (
          <SpecialistCard
            key={card.id}
            {...card}
            imageAlt={card.name}
            profileHref={`/specialists/${s.id}`}
            slotGroups={slotGroupsFromSeed(card.slotGroups, tSlots, {
              locale,
              maxGroups: 5,
              now,
            })}
          />
        );
      })}
    </div>
  );
}

export function HomeTopOrganizationCards({ list }: { list: OrganizationList }) {
  const tSlots = useTranslations("slots");
  const locale = useLocale() as AppLocale;
  const now = useListingClock();

  return (
    <div className="space-y-2.5">
      {list.map((o) => {
        const card = organizationCardSeedFromApi(o, now);
        return (
          <OrganizationCard
            key={card.id}
            {...card}
            imageAlt={card.name}
            profileHref={`/organizations/${o.id}`}
            slotGroups={slotGroupsFromSeed(card.slotGroups, tSlots, {
              locale,
              maxGroups: 5,
              now,
            })}
          />
        );
      })}
    </div>
  );
}
