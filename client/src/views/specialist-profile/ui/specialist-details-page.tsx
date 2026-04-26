"use client";

import { Building2, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/app/i18n/navigation";
import { AppBackButton } from "@/shared/ui";
import { cn, motion } from "@/shared/lib";
import { HomeBottomNav } from "@/widgets/home";
import type { SpecialistActiveWorkplace } from "../model/specialist-profile-data";

export type SpecialistDetailsPageProps = {
  specialistId: string;
  name: string;
  bio: string | null;
  activeWorkplace: SpecialistActiveWorkplace | null;
};

export function SpecialistDetailsPage({
  specialistId,
  name,
  bio,
  activeWorkplace,
}: SpecialistDetailsPageProps) {
  const t = useTranslations("specialistDetails");
  const fallback = `/specialists/${specialistId}`;
  const trimmed = bio?.trim() ?? "";

  return (
    <div className="flex min-h-screen flex-col bg-surface-background">
      <div className="mx-auto w-full max-w-lg flex-1 px-4 pt-3 pb-28">
        <div className="mb-6 flex items-center gap-2">
          <AppBackButton fallback={fallback} ariaLabel={t("backAria")} />
          <div className="min-w-0">
            <h1 className="font-heading text-lg font-semibold leading-tight text-foreground">
              {t("title")}
            </h1>
            <p className="truncate text-sm text-muted-foreground">{name}</p>
          </div>
        </div>

        <section className="rounded-[1.35rem] border border-border/70 bg-card px-4 py-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("aboutHeading")}
          </h2>
          {trimmed ? (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {trimmed}
            </p>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {t("bioEmpty")}
            </p>
          )}
        </section>

        {activeWorkplace ? (
          <section className="mt-4 rounded-[1.35rem] border border-border/70 bg-card px-4 py-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("workplaceHeading")}
            </h2>
            <Link
              href={`/organizations/${activeWorkplace.id}`}
              aria-label={t("workplaceOpenAria", {
                name: activeWorkplace.name,
              })}
              className={cn(
                motion.interactivePressStrong,
                "mt-3 flex min-h-11 items-center gap-3 rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              )}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Building2 className="size-[1.05rem]" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground">
                {activeWorkplace.name}
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </Link>
          </section>
        ) : null}
      </div>

      <HomeBottomNav activeId="search" />
    </div>
  );
}
