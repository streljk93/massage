"use client";

import { Star } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/app/i18n/navigation";
import { cn } from "@/shared/lib";

export type ProfileHeroRatingLineProps = {
  rating: number;
  reviewsCount: number;
  reviewsHref: string;
  className?: string;
};

export function ProfileHeroRatingLine({
  rating,
  reviewsCount,
  reviewsHref,
  className,
}: ProfileHeroRatingLineProps) {
  const t = useTranslations("profileVitrine");
  const format = useFormatter();

  if (rating <= 0 && reviewsCount <= 0) {
    return null;
  }

  return (
    <p className={cn("flex flex-wrap items-center gap-2 text-sm", className)}>
      {rating > 0 ? (
        <span className="font-semibold tabular-nums text-foreground">
          {rating.toFixed(1)}
        </span>
      ) : null}
      {rating > 0 ? (
        <span className="inline-flex items-center gap-0.5" aria-hidden>
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              className="size-3.5 fill-surface-secondary text-surface-secondary sm:size-4"
              strokeWidth={0}
            />
          ))}
        </span>
      ) : null}
      <Link
        href={reviewsHref}
        className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        {t("reviewsCount", { count: format.number(reviewsCount) })}
      </Link>
    </p>
  );
}
