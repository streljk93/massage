"use client";

import { Calendar, Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/app/i18n/navigation";
import { UserAvatar } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { cn, listExitRowClassNames, motion } from "@/shared/lib";

/** Белая заливка + тонкая обводка (не `variant="secondary"` — там брендовый `--secondary`). */
const actionOutlineButtonClass =
  "h-11 w-full rounded-xl border border-border bg-card font-medium text-foreground shadow-none hover:bg-muted/45 hover:text-foreground active:bg-muted/55";

export type BookingListStatus = "pending" | "confirmed" | "expired" | "rejected";

export type BookingListCardProps = {
  status: BookingListStatus;
  /** Время в строке статуса для `pending`, например `14:32`. */
  pendingTime?: string;
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
  className?: string;
};

export function BookingListCard({
  status,
  pendingTime,
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
  className,
}: BookingListCardProps) {
  const t = useTranslations("bookingList");
  const muted =
    slotMuted ?? (status === "expired" || status === "rejected");

  const statusLine =
    status === "pending" && pendingTime
      ? t("statusPending", { time: pendingTime })
      : status === "pending"
        ? t("statusPending", { time: "—" })
        : status === "confirmed"
          ? t("statusConfirmed")
          : status === "expired"
            ? t("statusExpired")
            : t("statusRejected");

  const exit = listExitRowClassNames(
    isExiting ?? false,
    cn("rounded-2xl border border-border/60 bg-card p-3", className),
  );

  return (
    <div className={exit.outer}>
      <div className={exit.inner}>
        <article aria-hidden={isExiting} className={exit.card}>
          <p className="text-[0.7rem] text-muted-foreground">{statusLine}</p>

          {specialistProfileHref ? (
            <Link
              href={specialistProfileHref}
              className={cn(
                motion.interactivePressStrong,
                "mt-2 flex gap-3 rounded-xl px-1 py-0.5 text-left outline-none ring-border/40 transition-colors hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-ring/45",
              )}
              aria-label={t("openSpecialistProfile", { name: providerName })}
            >
              <UserAvatar
                src={avatarSrc}
                alt=""
                fallback={providerName.slice(0, 2).toUpperCase()}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="font-heading text-sm font-semibold tracking-tight text-foreground">
                  {providerName}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {serviceLine}
                </p>
              </div>
            </Link>
          ) : (
            <div className="mt-2 flex gap-3">
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
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {serviceLine}
                </p>
              </div>
            </div>
          )}

          <div
            className={cn(
              "mt-3 flex flex-wrap gap-2 rounded-xl bg-muted/80 px-2.5 py-2 text-xs",
              muted && "text-muted-foreground/70",
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-3.5 shrink-0 opacity-80" aria-hidden />
              {dateLabel}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5 shrink-0 opacity-80" aria-hidden />
              {timeRange}
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {status === "pending" ? (
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
            ) : null}

            {status === "confirmed" ? (
              <>
                <Button type="button" variant="ghost" className={actionOutlineButtonClass}>
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
            ) : null}

            {status === "expired" || status === "rejected" ? (
              <Button type="button" variant="ghost" className={actionOutlineButtonClass}>
                {t("findOther")}
              </Button>
            ) : null}
          </div>
        </article>
      </div>
    </div>
  );
}
