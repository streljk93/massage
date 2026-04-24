"use client";

import type { ReactNode } from "react";
import { Calendar, Clock } from "lucide-react";
import { Link } from "@/app/i18n/navigation";
import { UserAvatar } from "@/shared/ui/avatar";
import { Tag } from "@/shared/ui/tag";
import { cn, motion } from "@/shared/lib";

export type BookingShowcaseVariant = "dark" | "light";

export type BookingShowcaseCardProps = {
  specialistName: string;
  serviceLine: string;
  dateLabel: string;
  timeRange: string;
  avatarSrc?: string | null;
  className?: string;
  /** `dark` — как на главной (`neutral-800`); `light` — карточка списка записей (`bg-card`, обе темы). */
  variant?: BookingShowcaseVariant;
  /** Если задано — строка мастера ведёт в профиль. */
  specialistProfileHref?: string;
  specialistLinkAriaLabel?: string;
  /** Нижняя полоса статуса / таймера. */
  statusFooter?: ReactNode;
  /**
   * Светлая карточка: фон полосы статуса в «успех» (тот же `primary`, что success-toast), например «Подтверждено».
   */
  statusFooterSuccess?: boolean;
  /** Полоса статуса «идёт приём» — приглушённый синий фон (приоритет над `statusFooterSuccess`). */
  statusFooterInProgress?: boolean;
  /** Кнопки и прочие действия под статусом (страница записей). */
  actions?: ReactNode;
  /** Приглушить дату/время и полосу статуса (например просрочено). Для `light` — те же правила, что у списка. */
  dateTagsMuted?: boolean;
  /** Вместо чипов даты и времени (тот же ряд и стилистика тегов). */
  dateTagsReplacement?: ReactNode;
};

/**
 * Карточка брони: тёмный вариант (главная) или вариант списка (история / новые — токены темы).
 */
export function BookingShowcaseCard({
  specialistName,
  serviceLine,
  dateLabel,
  timeRange,
  avatarSrc,
  className,
  variant = "dark",
  specialistProfileHref,
  specialistLinkAriaLabel,
  statusFooter,
  statusFooterSuccess,
  statusFooterInProgress,
  actions,
  dateTagsMuted,
  dateTagsReplacement,
}: BookingShowcaseCardProps) {
  const isDark = variant === "dark";

  const header = (
    <>
      <UserAvatar
        src={avatarSrc}
        alt={specialistProfileHref ? "" : specialistName}
        fallback={specialistName.slice(0, 2).toUpperCase()}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate font-heading text-sm font-semibold tracking-tight",
            isDark ? "text-white" : "text-foreground",
          )}
        >
          {specialistName}
        </p>
        <p
          className={cn(
            "mt-0.5 truncate text-xs",
            isDark ? "text-white/65" : "text-muted-foreground",
          )}
        >
          {serviceLine}
        </p>
      </div>
    </>
  );

  const linkClass = isDark
    ? cn(
        motion.interactivePressStrong,
        "flex w-full min-w-0 gap-3 rounded-xl px-1 py-0.5 text-left outline-none ring-white/25 transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/40",
      )
    : cn(
        motion.interactivePressStrong,
        "flex w-full min-w-0 gap-3 rounded-xl px-1 py-0.5 text-left outline-none ring-border/40 transition-colors hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-ring/45",
      );

  const tagVariant = isDark ? "inverse" : "outline";
  const tagClass = "text-[0.7rem]";

  const footerWrapClass = isDark
    ? cn(
        "mt-3 rounded-lg px-2 py-1.5 text-[0.7rem] leading-snug",
        statusFooterInProgress
          ? "bg-sky-400/35"
          : statusFooterSuccess
            ? "bg-primary/25"
            : "bg-white/10",
      )
    : cn(
        "mt-3 rounded-xl px-2.5 py-2 text-xs leading-snug",
        statusFooterInProgress
          ? "bg-sky-500/22 text-foreground"
          : statusFooterSuccess
            ? "bg-primary/20 text-foreground"
            : cn(
                "bg-muted/80",
                dateTagsMuted && "text-muted-foreground/70",
              ),
      );

  const inProgressLeftBorder = !isDark && statusFooterInProgress;

  const cardBody = (
    <>
      {specialistProfileHref ? (
        <Link
          href={specialistProfileHref}
          className={linkClass}
          aria-label={
            specialistLinkAriaLabel ??
            `${specialistName} — ${serviceLine}`
          }
        >
          {header}
        </Link>
      ) : (
        <div className="flex min-w-0 w-full gap-3">{header}</div>
      )}

      <div
        className={cn(
          "mt-3 flex min-w-0 flex-wrap gap-2",
          dateTagsMuted && "opacity-60",
        )}
      >
        {dateTagsReplacement != null ? (
          dateTagsReplacement
        ) : (
          <>
            <Tag variant={tagVariant} className={tagClass}>
              <Calendar className="size-3.5" aria-hidden />
              {dateLabel}
            </Tag>
            <Tag variant={tagVariant} className={tagClass}>
              <Clock className="size-3.5" aria-hidden />
              {timeRange}
            </Tag>
          </>
        )}
      </div>

      {statusFooter ? (
        <div className={footerWrapClass}>{statusFooter}</div>
      ) : null}

      {actions ? (
        <div className="mt-3 space-y-2">{actions}</div>
      ) : null}
    </>
  );

  return (
    <div
      className={cn(
        "w-full min-w-0 max-w-full rounded-2xl p-3",
        isDark
          ? "bg-neutral-800 text-white"
          : cn(
              "border border-border/60 bg-card text-card-foreground",
              inProgressLeftBorder && "border-l-4 border-l-sky-500",
            ),
        className,
      )}
    >
      {cardBody}
    </div>
  );
}
