"use client";

import { Calendar, Clock, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { UserAvatar } from "@/shared/ui/avatar";
import { cn } from "@/shared/lib";

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
  providerName: string;
  serviceLine: string;
  dateLabel: string;
  timeRange: string;
  avatarSrc?: string | null;
  /** Есть ли отзыв; если нет — блок «Review me» и пустые звёзды. */
  reviewed: boolean;
  /** 1–5 при `reviewed`. */
  rating?: number;
  /** Текст отзыва (превью), если `reviewed`. */
  reviewExcerpt?: string;
  className?: string;
};

export function BookingHistoryCard({
  providerName,
  serviceLine,
  dateLabel,
  timeRange,
  avatarSrc,
  reviewed,
  rating = 0,
  reviewExcerpt,
  className,
}: BookingHistoryCardProps) {
  const t = useTranslations("bookingHistory");
  const stars = Math.min(5, Math.max(0, Math.round(rating)));

  return (
    <article
      className={cn(
        "rounded-2xl border border-border/60 bg-card p-3",
        className,
      )}
    >
      <div className="flex gap-3">
        <UserAvatar
          src={avatarSrc}
          alt={providerName}
          fallback={providerName.slice(0, 2).toUpperCase()}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="font-heading text-sm font-semibold tracking-tight text-foreground">
            {providerName}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{serviceLine}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-muted/80 px-2.5 py-2 text-xs text-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="size-3.5 shrink-0 opacity-80" aria-hidden />
          {dateLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-3.5 shrink-0 opacity-80" aria-hidden />
          {timeRange}
        </span>
      </div>

      <div className="mt-3 border-t border-border/50 pt-3">
        {!reviewed ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{t("reviewMe")}</p>
            <HistoryStars filledCount={0} emptyOutlined />
          </div>
        ) : (
          <div className="space-y-1.5">
            <HistoryStars filledCount={stars} />
            {reviewExcerpt ? (
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {reviewExcerpt}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </article>
  );
}
