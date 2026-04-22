"use client";

import { useTranslations } from "next-intl";
import { usePendingBookingCountdown } from "../lib/use-pending-booking-countdown";
import { BookingShowcaseCard } from "./booking-showcase-card";

export type BookingCardProps = {
  specialistName: string;
  serviceLine: string;
  dateLabel: string;
  timeRange: string;
  avatarSrc?: string | null;
  className?: string;
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
  pendingConfirmationExpiresAt,
  onPendingConfirmationExpired,
}: BookingCardProps) {
  const t = useTranslations("booking");
  const countdown = usePendingBookingCountdown(
    pendingConfirmationExpiresAt,
    Boolean(pendingConfirmationExpiresAt),
    onPendingConfirmationExpired,
  );

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
    />
  );
}
