"use client";

import { Star } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/app/i18n/navigation";
import { cn, motion } from "@/shared/lib";
import { Rating } from "@/shared/ui/rating";

export type ProfileReviewsTeaserProps = {
  rating: number;
  reviewsCount: number;
  reviewsHref: string;
  className?: string;
  /** Show hardcoded sample review card (Figma services tab sidebar). */
  showSampleReview?: boolean;
};

export function ProfileReviewsTeaser({
  rating,
  reviewsCount,
  reviewsHref,
  className,
  showSampleReview = false,
}: ProfileReviewsTeaserProps) {
  const t = useTranslations("profileVitrine");
  const format = useFormatter();

  const distribution = [
    { stars: 5, pct: 82 },
    { stars: 4, pct: 12 },
    { stars: 3, pct: 4 },
    { stars: 2, pct: 1 },
    { stars: 1, pct: 1 },
  ];

  return (
    <section className={cn("space-y-4", className)}>
      <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
        {t("reviewsTitle")}
      </h2>
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-wrap items-start gap-8">
          <div className="space-y-1">
            <p className="font-heading text-5xl font-bold tabular-nums leading-none text-foreground">
              {rating > 0 ? rating.toFixed(1) : "—"}
            </p>
            <Rating value={rating} className="[&_span:last-child]:hidden" />
            <p className="text-sm text-muted-foreground">
              {t("reviewsCount", { count: format.number(reviewsCount) })}
            </p>
          </div>
          <div className="min-w-[140px] flex-1 space-y-1.5">
            {distribution.map((row) => (
              <div
                key={row.stars}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <span className="w-3 tabular-nums">{row.stars}</span>
                <Star
                  className="size-3 fill-surface-secondary text-surface-secondary"
                  strokeWidth={0}
                  aria-hidden
                />
                <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-muted">
                  <div
                    className="h-full rounded-sm bg-surface-secondary"
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showSampleReview ? (
        <div className="space-y-3 rounded-lg border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <div
              className="size-10 shrink-0 rounded-full bg-muted"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {t("sampleReviewAuthor")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("sampleReviewDate")}
              </p>
            </div>
            <span className="text-sm text-surface-secondary" aria-hidden>
              ★★★★★
            </span>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("sampleReviewText")}
          </p>
        </div>
      ) : null}

      <Link
        href={reviewsHref}
        className={cn(
          motion.interactivePressStrong,
          "inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline",
        )}
      >
        {t("reviewsSeeAll")}
      </Link>
    </section>
  );
}
