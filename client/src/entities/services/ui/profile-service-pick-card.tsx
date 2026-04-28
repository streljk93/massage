"use client";

import { cn, motion } from "@/shared/lib";
import {
  type BookableServiceOption,
  priceForDuration,
} from "../model/bookable-service-option";

export type ProfileServicePickCardProps = {
  service: BookableServiceOption;
  selected: boolean;
  selectedDurationMinutes: number;
  formatPrice: (vnd: number) => string;
  formatDurationMinutes: (minutes: number) => string;
  onSelectService: () => void;
  onSelectDuration: (minutes: number) => void;
};

function serviceDisplayLabel(service: BookableServiceOption): string {
  return service.categoryShortName?.trim() || "";
}

/** Карточка выбора услуги на экранах профиля специалиста / организации. */
export function ProfileServicePickCard({
  service,
  selected,
  selectedDurationMinutes,
  formatPrice,
  formatDurationMinutes,
  onSelectService,
  onSelectDuration,
}: ProfileServicePickCardProps) {
  const displayPrice = priceForDuration(service, selectedDurationMinutes);
  const lineLabel = serviceDisplayLabel(service);

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 transition-colors",
        selected
          ? "border-primary/35 bg-primary/[0.07]"
          : "border-border/60 bg-card hover:border-border",
      )}
    >
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onSelectService}
      >
        <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground">
          {lineLabel}
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {formatPrice(displayPrice)}
          </span>
          <span
            className={cn(
              "flex size-[1.125rem] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
              selected
                ? "border-primary bg-primary"
                : "border-muted-foreground/35 bg-transparent",
            )}
            aria-hidden
          >
            {selected ? (
              <span className="size-1.5 rounded-full bg-primary-foreground" />
            ) : null}
          </span>
        </div>
      </button>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {service.durationMinutes.map((m) => {
          const active = selected && selectedDurationMinutes === m;
          return (
            <button
              key={m}
              type="button"
              className={cn(
                motion.interactivePressStrong,
                "inline-flex h-8 items-center rounded-full border px-3 text-sm transition-colors",
                active
                  ? "border-primary/40 bg-primary/12 font-semibold text-primary"
                  : "border-transparent bg-muted/40 font-normal text-foreground hover:bg-muted/55",
              )}
              onClick={() => onSelectDuration(m)}
            >
              {formatDurationMinutes(m)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
