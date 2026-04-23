"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useThemePreference } from "@/shared/lib/theme-preference-provider";
import type { ThemePreference } from "@/shared/lib/theme-preference";
import { cn, motion } from "@/shared/lib";
import { ProfileSubpageShell } from "./profile-subpage-shell";

const OPTIONS: { value: ThemePreference; labelKey: "system" | "light" | "dark" }[] =
  [
    { value: "system", labelKey: "system" },
    { value: "light", labelKey: "light" },
    { value: "dark", labelKey: "dark" },
  ];

export function ProfileThemePage() {
  const t = useTranslations("profileTheme");
  const { ready, preference, setPreference } = useThemePreference();

  return (
    <ProfileSubpageShell title={t("title")}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
        {!ready ? (
          <div
            className="h-44 animate-pulse rounded-2xl bg-muted/50"
            aria-busy
            aria-label={t("title")}
          />
        ) : (
          <ul
            className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card"
            role="listbox"
            aria-label={t("title")}
          >
            {OPTIONS.map(({ value, labelKey }) => {
              const selected = preference === value;
              return (
                <li key={value} className="p-0">
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
                    onClick={() => setPreference(value)}
                  >
                    <span className="min-w-0 flex-1">{t(labelKey)}</span>
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
        )}
      </div>
    </ProfileSubpageShell>
  );
}
