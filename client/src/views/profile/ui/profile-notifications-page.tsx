"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ProfileSubpageShell } from "./profile-subpage-shell";
import { Switch } from "@/shared/ui";

type ToggleId = "booking" | "promo" | "email";

export function ProfileNotificationsPage() {
  const t = useTranslations("profileNotifications");
  const [on, setOn] = useState<Record<ToggleId, boolean>>({
    booking: true,
    promo: false,
    email: true,
  });

  const rows: {
    id: ToggleId;
    titleKey: "bookingTitle" | "promoTitle" | "emailTitle";
    descKey: "bookingDescription" | "promoDescription" | "emailDescription";
  }[] = [
    {
      id: "booking",
      titleKey: "bookingTitle",
      descKey: "bookingDescription",
    },
    {
      id: "promo",
      titleKey: "promoTitle",
      descKey: "promoDescription",
    },
    {
      id: "email",
      titleKey: "emailTitle",
      descKey: "emailDescription",
    },
  ];

  return (
    <ProfileSubpageShell title={t("title")}>
      <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card">
        {rows.map((row) => {
          const enabled = on[row.id];
          return (
            <li key={row.id} className="flex items-start gap-3 px-4 py-4">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {t(row.titleKey)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t(row.descKey)}
                </p>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={(v) => {
                  setOn((prev) => ({ ...prev, [row.id]: v }));
                }}
                aria-label={`${t(row.titleKey)}: ${enabled ? t("on") : t("off")}`}
              />
            </li>
          );
        })}
      </ul>
    </ProfileSubpageShell>
  );
}
