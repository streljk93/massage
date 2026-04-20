"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn, motion } from "@/shared/lib";
import {
  defaultProfileLocationId,
  profileLocationOptions,
  type ProfileLocationOptionId,
} from "../lib/mock-locations";
import { ProfileSubpageShell } from "./profile-subpage-shell";

export function ProfileLocationPage() {
  const t = useTranslations("profileLocation");
  const [selectedId, setSelectedId] = useState<ProfileLocationOptionId>(
    defaultProfileLocationId,
  );

  return (
    <ProfileSubpageShell title={t("title")}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
        <ul
          className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card"
          role="listbox"
          aria-label={t("title")}
        >
          {profileLocationOptions.map((row) => {
            const selected = selectedId === row.id;
            return (
              <li key={row.id} className="p-0">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={cn(
                    motion.interactivePressStrong,
                    "flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium",
                    selected
                      ? "bg-muted/50 text-foreground"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                  )}
                  onClick={() => setSelectedId(row.id)}
                >
                  <span className="min-w-0 flex-1">{t(row.labelKey)}</span>
                  {selected ? (
                    <Check
                      className="size-4 shrink-0 text-primary"
                      aria-hidden
                    />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </ProfileSubpageShell>
  );
}
