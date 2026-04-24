"use client";

import { useTranslations } from "next-intl";
import { Tag } from "@/shared/ui/tag";
import { cn } from "@/shared/lib";
import { usePendingBookingCountdown } from "../lib/use-pending-booking-countdown";
import { BookingShowcaseCard } from "./booking-showcase-card";

export type BookingCardProps = {
  specialistName: string;
  serviceLine: string;
  dateLabel: string;
  timeRange: string;
  avatarSrc?: string | null;
  className?: string;
  /** Статус брони с API (главная: `in_progress` — строка статуса и акцент). */
  apiBookingStatus?: string;
  /** Подпись статуса с API; для `in_progress` приоритетнее `inProgress` из i18n. */
  statusLabel?: string;
  /** Если запись в статусе pending — дедлайн подтверждения (ISO). */
  pendingConfirmationExpiresAt?: string | null;
  /** Когда таймер дошёл до нуля — перезагрузить список с главной. */
  onPendingConfirmationExpired?: () => void;
};

export function BookingCard({
  specialistName,
  serviceLine,
  dateLabel,
  timeRange,
  avatarSrc,
  className,
  apiBookingStatus,
  statusLabel,
  pendingConfirmationExpiresAt,
  onPendingConfirmationExpired,
}: BookingCardProps) {
  const t = useTranslations("booking");
  const countdown = usePendingBookingCountdown(
    pendingConfirmationExpiresAt,
    Boolean(pendingConfirmationExpiresAt),
    onPendingConfirmationExpired,
  );

  const isInProgress = apiBookingStatus === "in_progress";

  const statusFooter =
    pendingConfirmationExpiresAt != null && pendingConfirmationExpiresAt !== ""
      ? countdown != null ? (
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 flex-1 font-medium leading-snug text-white">
              {t("pendingAwaiting")}
            </p>
            <p
              className="shrink-0 tabular-nums text-white/75"
              aria-label={t("pendingTimer", {
                minutes: countdown.minutes,
                seconds: countdown.seconds,
              })}
            >
              {t("pendingTimeCompact", {
                minutes: countdown.minutes,
                seconds: countdown.seconds,
              })}
            </p>
          </div>
        ) : (
          <p className="font-medium text-white">{t("pendingAwaiting")}</p>
        )
      : undefined;

  const inProgressLine = isInProgress
    ? statusLabel != null && statusLabel.trim() !== ""
      ? statusLabel.trim()
      : t("inProgress")
    : null;

  const dateTagsReplacement =
    inProgressLine != null ? (
      <Tag
        variant="inverse"
        className={cn(
          "h-[34px] w-full min-w-0 justify-start gap-1.5 truncate text-[0.7rem] font-medium py-0",
        )}
      >
        {inProgressLine}
      </Tag>
    ) : undefined;

  return (
    <BookingShowcaseCard
      variant="dark"
      specialistName={specialistName}
      serviceLine={serviceLine}
      dateLabel={dateLabel}
      timeRange={timeRange}
      avatarSrc={avatarSrc}
      className={className}
      statusFooter={statusFooter}
      dateTagsReplacement={dateTagsReplacement}
    />
  );
}
