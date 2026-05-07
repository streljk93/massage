"use client";

import { useTranslations } from "next-intl";
import { cn, motion } from "@/shared/lib";
import type { MajorSphereTabModel } from "../lib/major-sphere-tabs-from-services";

export type ProfileServiceSphereChipsProps = {
  items: MajorSphereTabModel[];
  valueSlug: string;
  onChange: (majorSlug: string) => void;
  disabled?: boolean;
};

/** Тэги сферы под блоком «Выберите услугу» на публичной карточке. */
export function ProfileServiceSphereChips({
  items,
  valueSlug,
  onChange,
  disabled = false,
}: ProfileServiceSphereChipsProps) {
  const t = useTranslations("profileServiceSphere");
  if (items.length <= 1) {
    return null;
  }
  return (
    <div
      className="flex flex-wrap gap-2"
      role="radiogroup"
      aria-label={t("ariaGroup")}
    >
      {items.map((tab) => {
        const selected = tab.slug === valueSlug;
        return (
          <button
            key={tab.slug}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(tab.slug)}
            className={cn(
              motion.interactivePressStrong,
              "touch-target inline-flex min-h-10 items-center justify-center rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-60",
              selected ?
                "border-primary/45 bg-primary/12 text-primary"
              : "border-border/55 bg-muted/35 text-foreground hover:bg-muted/55",
            )}
          >
            {tab.name}
          </button>
        );
      })}
    </div>
  );
}
