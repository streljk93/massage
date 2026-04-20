"use client";

import { Star, UserRound } from "lucide-react";
import { useRouter } from "@/app/i18n/navigation";
import { Button } from "@/shared/ui/button";
import { cn, motion } from "@/shared/lib";
import type { SalonSpecialistPick } from "../model/salon-specialist-pick";

export type SalonSpecialistPickCardProps = {
  pick: SalonSpecialistPick;
  selected: boolean;
  selectLabel: string;
  /** Текст кнопки при выбранном специалисте (например «Выбран»). */
  selectedLabel: string;
  onSelect: () => void;
  /** Ссылка на профиль специалиста; при наличии клик по карточке (не по кнопке) ведёт туда. */
  profileHref?: string;
  /** Подпись для доступности всей карточки-ссылки (если задан `profileHref`). */
  openProfileAriaLabel?: string;
  className?: string;
};

/** Карточка мастера для выбора на экране салона (аватар слева, данные справа; в списке — колонка). */
export function SalonSpecialistPickCard({
  pick,
  selected,
  selectLabel,
  selectedLabel,
  onSelect,
  profileHref,
  openProfileAriaLabel,
  className,
}: SalonSpecialistPickCardProps) {
  const router = useRouter();
  const cardNavigable = Boolean(profileHref);

  const goToProfile = () => {
    if (profileHref) {
      router.push(profileHref);
    }
  };

  return (
    <div
      data-selected={selected}
      tabIndex={cardNavigable ? 0 : undefined}
      aria-label={cardNavigable ? openProfileAriaLabel : undefined}
      onClick={cardNavigable ? goToProfile : undefined}
      onKeyDown={
        cardNavigable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                goToProfile();
              }
            }
          : undefined
      }
      className={cn(
        "flex min-h-[7.5rem] w-full min-w-0 overflow-hidden rounded-2xl border-2 bg-transparent shadow-none transition-colors",
        selected
          ? "border-primary/55 bg-primary/[0.06]"
          : "border-transparent",
        cardNavigable &&
          "cursor-pointer outline-none hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2",
        className,
      )}
    >
      <div className="relative w-[7.625rem] shrink-0 self-stretch bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pick.imageSrc}
          alt={pick.imageAlt}
          className="absolute inset-0 size-full object-cover"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 p-2.5 pr-3 pb-2">
        <div className="flex items-start justify-between gap-1.5">
          <div className="flex min-w-0 items-center gap-1">
            <Star
              className="size-3.5 shrink-0 fill-amber-400 text-amber-400"
              strokeWidth={0}
              aria-hidden
            />
            <span className="text-xs font-semibold tabular-nums text-foreground">
              {pick.rating.toFixed(1)}
            </span>
          </div>
          <UserRound
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </div>
        <p className="font-heading text-sm font-semibold leading-tight tracking-tight text-foreground">
          {pick.name}
        </p>
        <p className="line-clamp-2 text-[0.7rem] leading-snug text-muted-foreground">
          {pick.metaLine}
        </p>
        <p className="line-clamp-2 text-[0.7rem] leading-snug text-muted-foreground">
          {pick.specialtiesLine}
        </p>
        <div className="mt-auto w-full pt-1.5">
          <Button
            type="button"
            variant="secondary"
            tone="light"
            aria-pressed={selected}
            className={cn(
              motion.interactivePressStrong,
              "h-9 w-full rounded-2xl border px-4 text-sm shadow-none pointer-events-auto transition-colors",
              selected
                ? "border-primary/40 bg-primary/12 font-semibold text-primary hover:bg-primary/16"
                : "border-transparent bg-muted/40 font-medium text-foreground hover:bg-muted/55",
            )}
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
          >
            {selected ? selectedLabel : selectLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
