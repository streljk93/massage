"use client";

import { ChevronRight } from "lucide-react";
import { cn, motion } from "@/shared/lib";

export type ProfileServiceRowProps = {
  title: string;
  durationLabel: string;
  priceLabel: string;
  onSelect?: () => void;
  ariaLabel?: string;
  className?: string;
};

export function ProfileServiceRow({
  title,
  durationLabel,
  priceLabel,
  onSelect,
  ariaLabel,
  className,
}: ProfileServiceRowProps) {
  const Comp = onSelect ? "button" : "div";

  return (
    <Comp
      type={onSelect ? "button" : undefined}
      aria-label={ariaLabel}
      onClick={onSelect}
      className={cn(
        onSelect && motion.interactivePressStrong,
        "flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-5 py-4 text-left",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="truncate font-heading text-[15px] font-semibold text-foreground">
          {title}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{durationLabel}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-[15px] font-semibold tabular-nums text-foreground">
          {priceLabel}
        </span>
        <ChevronRight className="size-5 text-muted-foreground/80" aria-hidden />
      </div>
    </Comp>
  );
}
