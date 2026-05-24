"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/shared/lib";

export type ProfileHeroAboutTextProps = {
  text: string | null;
  className?: string;
};

/** Plain bio/description in the hero column — no card wrapper (Figma). */
export function ProfileHeroAboutText({ text, className }: ProfileHeroAboutTextProps) {
  const t = useTranslations("profileVitrine");
  const trimmed = text?.trim() ?? "";

  if (!trimmed) {
    return (
      <p className={cn("text-sm leading-relaxed text-muted-foreground", className)}>
        {t("aboutEmpty")}
      </p>
    );
  }

  return (
    <p className={cn("text-sm leading-relaxed text-muted-foreground", className)}>
      {trimmed}
    </p>
  );
}
