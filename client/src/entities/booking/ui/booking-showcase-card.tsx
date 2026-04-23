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
  /** Кнопки и прочие действия под статусом (страница записей). */
  actions?: ReactNode;
  /** Приглушить дату/время и полосу статуса (например просрочено). Для `light` — те же правила, что у списка. */
  dateTagsMuted?: boolean;
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
  actions,
  dateTagsMuted,
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
            "font-heading text-sm font-semibold tracking-tight",
            isDark ? "text-white" : "text-foreground",
          )}
        >
          {specialistName}
        </p>
        <p
          className={cn(
            "mt-0.5 text-xs",
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
        "flex gap-3 rounded-xl px-1 py-0.5 text-left outline-none ring-white/25 transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/40",
      )
    : cn(
        motion.interactivePressStrong,
        "flex gap-3 rounded-xl px-1 py-0.5 text-left outline-none ring-border/40 transition-colors hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-ring/45",
      );

  const tagVariant = isDark ? "inverse" : "outline";
  const tagClass = "text-[0.7rem]";

  const footerWrapClass = isDark
    ? "mt-3 rounded-lg bg-white/10 px-2 py-1.5 text-[0.7rem] leading-snug"
    : cn(
        "mt-3 rounded-xl bg-muted/80 px-2.5 py-2 text-xs leading-snug",
        dateTagsMuted && "text-muted-foreground/70",
      );

  return (
    <div
      className={cn(
        "rounded-2xl p-3",
        isDark
          ? "bg-neutral-800 text-white"
          : "border border-border/60 bg-card text-card-foreground",
        className,
      )}
    >
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
        <div className="flex gap-3">{header}</div>
      )}

      <div
        className={cn(
          "mt-3 flex flex-wrap gap-2",
          dateTagsMuted && "opacity-60",
        )}
      >
        <Tag variant={tagVariant} className={tagClass}>
          <Calendar className="size-3.5" aria-hidden />
          {dateLabel}
        </Tag>
        <Tag variant={tagVariant} className={tagClass}>
          <Clock className="size-3.5" aria-hidden />
          {timeRange}
        </Tag>
      </div>

      {statusFooter ? (
        <div className={footerWrapClass}>{statusFooter}</div>
      ) : null}

      {actions ? (
        <div className="mt-3 space-y-2">{actions}</div>
      ) : null}
    </div>
  );
}
