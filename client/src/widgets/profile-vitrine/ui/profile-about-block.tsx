"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/shared/lib";

export type ProfileAboutBlockProps = {
  text: string | null;
  className?: string;
  compact?: boolean;
  /** Override default about heading */
  heading?: string;
};

export function ProfileAboutBlock({
  text,
  className,
  compact = false,
  heading,
}: ProfileAboutBlockProps) {
  const t = useTranslations("profileVitrine");
  const trimmed = text?.trim() ?? "";
  const title = heading ?? t("aboutTitle");

  return (
    <section className={cn("space-y-3", className)}>
      {!compact ? (
        <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h2>
      ) : null}
      <div className="rounded-xl border border-border bg-card p-4">
        {trimmed ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {trimmed}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{t("aboutEmpty")}</p>
        )}
      </div>
    </section>
  );
}
