"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/shared/lib";

function DoneVisitStars({ rating }: { rating: number }) {
  const filled = Math.min(5, Math.max(0, Math.round(rating)));
  return (
    <div className="flex items-center gap-0.5" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => {
        const on = i < filled;
        return (
          <Star
            key={i}
            className={cn(
              "size-3.5 shrink-0",
              on ? "fill-amber-400 text-amber-400" : "text-muted-foreground/35",
            )}
            strokeWidth={on ? 0 : 1.25}
            fill={on ? "currentColor" : "none"}
          />
        );
      })}
    </div>
  );
}

export type BookingDoneVisitReviewSummaryProps = {
  organizationRating: number | null | undefined;
  specialistRating: number | null | undefined;
  organizationExcerpt: string | null | undefined;
  specialistExcerpt: string | null | undefined;
};

export function BookingDoneVisitReviewSummary({
  organizationRating,
  specialistRating,
  organizationExcerpt,
  specialistExcerpt,
}: BookingDoneVisitReviewSummaryProps) {
  const t = useTranslations("bookingDoneVisitReview");
  const hasOrgRating =
    organizationRating != null && Number.isFinite(organizationRating);
  const hasSpRating = specialistRating != null && Number.isFinite(specialistRating);
  const orgComment = organizationExcerpt?.trim() ?? "";
  const spComment = specialistExcerpt?.trim() ?? "";
  const showOrgBlock = hasOrgRating || orgComment.length > 0;
  const showSpBlock = hasSpRating || spComment.length > 0;
  if (!showOrgBlock && !showSpBlock) {
    return null;
  }
  return (
    <div
      className="border-t border-border/40 pt-2 text-xs leading-snug"
      aria-label={t("sectionAria")}
    >
      {showOrgBlock ?
        <div className="space-y-0.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="shrink-0 font-semibold uppercase tracking-wide text-muted-foreground">
              {t("salonLabel")}
            </span>
            {hasOrgRating ?
              <DoneVisitStars rating={organizationRating} />
            : null}
          </div>
          {orgComment.length > 0 ?
            <p className="text-pretty leading-snug text-muted-foreground line-clamp-3 whitespace-pre-wrap break-words">
              {orgComment}
            </p>
          : null}
        </div>
      : null}
      {showSpBlock ?
        <div
          className={cn(
            "space-y-0.5",
            showOrgBlock && "mt-1.5 border-t border-border/25 pt-1.5",
          )}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="shrink-0 font-semibold uppercase tracking-wide text-muted-foreground">
              {t("specialistLabel")}
            </span>
            {hasSpRating ?
              <DoneVisitStars rating={specialistRating} />
            : null}
          </div>
          {spComment.length > 0 ?
            <p className="text-pretty leading-snug text-muted-foreground line-clamp-3 whitespace-pre-wrap break-words">
              {spComment}
            </p>
          : null}
        </div>
      : null}
    </div>
  );
}
