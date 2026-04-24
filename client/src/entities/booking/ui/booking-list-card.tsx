"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/shared/ui/button";
import { cn, listExitRowClassNames } from "@/shared/lib";
import { notify } from "@/shared/lib/notifications";
import {
  buildBookingIcsDocument,
  shareOrDownloadIcs,
} from "../lib/booking-calendar-ics";
import { usePendingBookingCountdown } from "../lib/use-pending-booking-countdown";
import { BookingShowcaseCard } from "./booking-showcase-card";

/** Белая заливка + тонкая обводка (не `variant="secondary"` — там брендовый `--secondary`). */
const actionOutlineButtonClass =
  "h-11 w-full rounded-xl border border-border bg-card font-medium text-foreground shadow-none hover:bg-muted/45 hover:text-foreground active:bg-muted/55";

export type BookingListStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "expired"
  | "rejected";

export type BookingListCardProps = {
  status: BookingListStatus;
  /** Локализованная подпись статуса с API (`statusLabel`). */
  statusLabel: string;
  /** Дедлайн подтверждения (ISO); для `pending` показываем обратный отсчёт. */
  pendingExpiresAt?: string | null;
  /** После авто-истечения pending — обновить список. */
  onPendingConfirmationExpired?: () => void;
  providerName: string;
  serviceLine: string;
  dateLabel: string;
  timeRange: string;
  avatarSrc?: string | null;
  /**
   * Приглушить блок даты/времени (просрочено / отклонено).
   * Если не задано, для `expired` и `rejected` включается автоматически.
   */
  slotMuted?: boolean;
  /** Отмена записи (вкладка «Новые» с API). */
  onCancel?: () => void;
  /** Запрос отмены для этой карточки уже идёт. */
  cancelPending?: boolean;
  /** Успешная отмена: плавное исчезновение перед удалением из списка. */
  isExiting?: boolean;
  /** Ссылка на профиль специалиста (например `/specialists/{id}`). */
  specialistProfileHref?: string;
  /** Id сущности `Booking` (календарь .ics). */
  bookingEntityId?: string;
  /** ISO начала/конца слота — кнопка «Добавить в календарь» → .ics / share. */
  calendarStartsAtIso?: string;
  calendarEndsAtIso?: string;
  className?: string;
};

export function BookingListCard({
  status,
  statusLabel,
  pendingExpiresAt,
  onPendingConfirmationExpired,
  providerName,
  serviceLine,
  dateLabel,
  timeRange,
  avatarSrc,
  slotMuted,
  onCancel,
  cancelPending,
  isExiting,
  specialistProfileHref,
  bookingEntityId,
  calendarStartsAtIso,
  calendarEndsAtIso,
  className,
}: BookingListCardProps) {
  const t = useTranslations("bookingList");
  const [remindBusy, setRemindBusy] = useState(false);
  const countdown = usePendingBookingCountdown(
    pendingExpiresAt,
    status === "pending",
    onPendingConfirmationExpired,
  );
  const muted =
    slotMuted ?? (status === "expired" || status === "rejected");

  const statusLine =
    statusLabel.trim() !== "" ? statusLabel.trim() : "\u2014";

  const statusFooter =
    status === "pending" && countdown != null ? (
      <div className="flex w-full min-w-0 items-baseline justify-between gap-3">
        <p className="min-w-0 flex-1 font-medium leading-snug text-foreground">
          {statusLine}
        </p>
        <p
          className="shrink-0 tabular-nums text-muted-foreground"
          aria-label={t("statusPendingTimer", {
            minutes: countdown.minutes,
            seconds: countdown.seconds,
          })}
        >
          {t("statusPendingTimeCompact", {
            minutes: countdown.minutes,
            seconds: countdown.seconds,
          })}
        </p>
      </div>
    ) : (
      <p className="w-full font-medium text-foreground">{statusLine}</p>
    );

  const exit = listExitRowClassNames(
    isExiting ?? false,
    cn("bg-transparent p-0", className),
  );

  const canAddToCalendar =
    status === "confirmed" &&
    calendarStartsAtIso != null &&
    calendarStartsAtIso !== "" &&
    calendarEndsAtIso != null &&
    calendarEndsAtIso !== "" &&
    bookingEntityId != null &&
    bookingEntityId !== "";

  const handleAddToCalendar = useCallback(async () => {
    if (
      !canAddToCalendar ||
      calendarStartsAtIso == null ||
      calendarEndsAtIso == null ||
      bookingEntityId == null
    ) {
      return;
    }
    setRemindBusy(true);
    try {
      const ics = buildBookingIcsDocument({
        uid: `${bookingEntityId}@services-booking`,
        startsAtIso: calendarStartsAtIso,
        endsAtIso: calendarEndsAtIso,
        summary: `${serviceLine} — ${providerName}`,
      });
      const result = await shareOrDownloadIcs(
        ics,
        `booking-${bookingEntityId.slice(0, 8)}.ics`,
      );
      if (result === "share" || result === "download") {
        notify.success(t("addToCalendarSuccess"));
      }
    } catch {
      notify.error(t("addToCalendarFailed"));
    } finally {
      setRemindBusy(false);
    }
  }, [
    bookingEntityId,
    calendarEndsAtIso,
    calendarStartsAtIso,
    canAddToCalendar,
    providerName,
    serviceLine,
    t,
  ]);

  const actions =
    status === "pending" ? (
      <Button
        type="button"
        variant="ghost"
        className={actionOutlineButtonClass}
        onClick={onCancel}
        disabled={cancelPending || !onCancel}
        aria-busy={cancelPending}
      >
        {t("cancel")}
      </Button>
    ) : status === "confirmed" ? (
      <>
        <Button
          type="button"
          variant="ghost"
          className={actionOutlineButtonClass}
          onClick={() => void handleAddToCalendar()}
          disabled={!canAddToCalendar || remindBusy}
          aria-busy={remindBusy}
          aria-label={t("remindMeAria")}
        >
          {t("remindMe")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={actionOutlineButtonClass}
          onClick={onCancel}
          disabled={cancelPending || !onCancel}
          aria-busy={cancelPending}
        >
          {t("cancel")}
        </Button>
      </>
    ) : status === "in_progress" ? null : status === "expired" || status === "rejected" ? (
      <Button type="button" variant="ghost" className={actionOutlineButtonClass}>
        {t("findOther")}
      </Button>
    ) : null;

  return (
    <div className={exit.outer}>
      <div className={exit.inner}>
        <article aria-hidden={isExiting} className={exit.card}>
          <BookingShowcaseCard
            variant="light"
            specialistName={providerName}
            serviceLine={serviceLine}
            dateLabel={dateLabel}
            timeRange={timeRange}
            avatarSrc={avatarSrc}
            specialistProfileHref={specialistProfileHref}
            specialistLinkAriaLabel={t("openSpecialistProfile", {
              name: providerName,
            })}
            statusFooter={statusFooter}
            statusFooterSuccess={status === "confirmed"}
            statusFooterInProgress={status === "in_progress"}
            dateTagsMuted={muted}
            actions={actions}
          />
        </article>
      </div>
    </div>
  );
}
