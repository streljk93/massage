"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/app/i18n/navigation";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib";
import { BOOKING_ACTION_OUTLINE_BUTTON_CLASS } from "./booking-list-card";
import { BookingDoneVisitReviewSummary } from "./booking-done-visit-review-summary";
import { BookingShowcaseCard } from "./booking-showcase-card";

function HistoryStars({
  filledCount,
  emptyOutlined,
}: {
  filledCount: number;
  /** Пустые звёзды с обводкой (ещё нет отзыва). */
  emptyOutlined?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-0.5"
      aria-hidden
    >
      {Array.from({ length: 5 }, (_, i) => {
        const filled = i < filledCount;
        return (
          <Star
            key={i}
            className={cn(
              "size-3.5 shrink-0 sm:size-4",
              filled
                ? "fill-amber-400 text-amber-400"
                : emptyOutlined
                  ? "text-muted-foreground/55"
                  : "text-muted-foreground/35",
            )}
            strokeWidth={filled ? 0 : 1.35}
            fill={filled ? "currentColor" : "none"}
          />
        );
      })}
    </div>
  );
}

export type BookingHistoryCardProps = {
  /** Подпись статуса с бэка (`BookingStatusLocale`), язык — как у запроса списка. */
  statusLabel: string;
  providerName: string;
  serviceLine: string;
  dateLabel: string;
  timeRange: string;
  avatarSrc?: string | null;
  specialistProfileHref?: string;
  /** Приглушить дату/время (отмена, истечение и т.п.). */
  dateTagsMuted?: boolean;
  /** Фон полосы статуса в стиле успеха (например «Подтверждено», завершённый визит). */
  statusFooterSuccess?: boolean;
  /** Системное пояснение (например авто-отмена из-за отсутствия подтверждения). */
  systemNote?: string;
  /**
   * Показывать блок отзыва / оценки (только завершённый визит `done`).
   * Для отменённых и прочих статусов не передавать или `false`.
   */
  reviewEligible?: boolean;
  /** Есть ли отзыв; если нет — блок «Review me» и пустые звёзды. */
  reviewed: boolean;
  /** URL страницы оценки визита (например `/bookings/{id}/rate`). */
  rateVisitHref?: string;
  /** Раздельные данные после оценки визита (актуальный API). */
  visitReviewOrganizationRating?: number | null;
  visitReviewSpecialistRating?: number | null;
  visitReviewOrganizationExcerpt?: string | null;
  visitReviewSpecialistExcerpt?: string | null;
  /** Fallback: средняя оценка (1–5), если раздельные поля недоступны. */
  rating?: number;
  /** Fallback: объединённое превью комментария. */
  reviewExcerpt?: string;
  className?: string;
};

export function BookingHistoryCard({
  statusLabel,
  providerName,
  serviceLine,
  dateLabel,
  timeRange,
  avatarSrc,
  specialistProfileHref,
  dateTagsMuted,
  statusFooterSuccess,
  systemNote,
  reviewEligible = false,
  reviewed,
  rateVisitHref,
  visitReviewOrganizationRating,
  visitReviewSpecialistRating,
  visitReviewOrganizationExcerpt,
  visitReviewSpecialistExcerpt,
  rating = 0,
  reviewExcerpt,
  className,
}: BookingHistoryCardProps) {
  const t = useTranslations("bookingHistory");
  const tList = useTranslations("bookingList");
  const stars = Math.min(5, Math.max(0, Math.round(rating)));

  const resolvedStatusLabel =
    statusLabel.trim() !== "" ? statusLabel : t("statusUnknown");

  const statusFooter =
    systemNote != null && systemNote !== "" ? (
      <div className="space-y-1.5">
        <p className="font-medium text-foreground">{resolvedStatusLabel}</p>
        <p role="note" className="text-xs leading-snug text-muted-foreground">
          {systemNote}
        </p>
      </div>
    ) : (
      <p className="font-medium text-foreground">{resolvedStatusLabel}</p>
    );

  const hasSplitVisitReviews =
    visitReviewOrganizationRating != null ||
    visitReviewSpecialistRating != null ||
    (visitReviewOrganizationExcerpt?.trim() ?? "").length > 0 ||
    (visitReviewSpecialistExcerpt?.trim() ?? "").length > 0;

  /** Как в ЛК салона: под полосой статуса через `footerExtra` (`mt-2`), не внутри `actions`. */
  const doneVisitReviewFooter =
    reviewEligible && reviewed && hasSplitVisitReviews ?
      <BookingDoneVisitReviewSummary
        organizationRating={visitReviewOrganizationRating}
        specialistRating={visitReviewSpecialistRating}
        organizationExcerpt={visitReviewOrganizationExcerpt}
        specialistExcerpt={visitReviewSpecialistExcerpt}
      />
    : undefined;

  const actions =
    reviewEligible && !(reviewed && hasSplitVisitReviews) ?
      <div className="border-t border-border/50 pt-3">
        {!reviewed && rateVisitHref != null && rateVisitHref !== "" ?
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{t("reviewMe")}</p>
            <Button
              asChild
              type="button"
              variant="ghost"
              className={BOOKING_ACTION_OUTLINE_BUTTON_CLASS}
            >
              <Link
                href={rateVisitHref}
                aria-label={t("rateVisitAria", { name: providerName })}
              >
                {t("rateVisit")}
              </Link>
            </Button>
          </div>
        : !reviewed ?
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{t("reviewMe")}</p>
            <HistoryStars filledCount={0} emptyOutlined />
          </div>
        : (
          <div className="space-y-1.5">
            <HistoryStars filledCount={stars} />
            {reviewExcerpt ?
              <p className="line-clamp-2 text-xs text-muted-foreground">{reviewExcerpt}</p>
            : null}
          </div>
        )}
      </div>
    : undefined;

  return (
    <BookingShowcaseCard
      variant="light"
      className={className}
      specialistName={providerName}
      serviceLine={serviceLine}
      dateLabel={dateLabel}
      timeRange={timeRange}
      avatarSrc={avatarSrc}
      specialistProfileHref={specialistProfileHref}
      specialistLinkAriaLabel={
        specialistProfileHref
          ? tList("openSpecialistProfile", { name: providerName })
          : undefined
      }
      statusFooter={statusFooter}
      statusFooterSuccess={statusFooterSuccess}
      footerExtra={doneVisitReviewFooter}
      actions={actions}
      dateTagsMuted={dateTagsMuted}
    />
  );
}
