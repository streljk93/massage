"use client";

import { cn } from "../lib";
import { Slider } from "./shadcn/slider";

export type PriceRangeSliderProps = {
  id?: string;
  min: number;
  max: number;
  step: number;
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
  formatValue: (n: number) => string;
  className?: string;
  disabled?: boolean;
  /** Ids of elements that label the slider (e.g. section title). */
  "aria-labelledby"?: string;
};

/**
 * Диапазон цен: обёртка над shadcn {@link Slider} (Radix) + подписи.
 */
export function PriceRangeSlider({
  id,
  min,
  max,
  step,
  value,
  onValueChange,
  formatValue,
  className,
  disabled,
  "aria-labelledby": ariaLabelledBy,
}: PriceRangeSliderProps) {
  const v0 = value[0] ?? min;
  const v1 = value[1] ?? max;

  return (
    <div className={cn("space-y-3 pt-0.5", className)}>
      <div
        className="flex items-baseline justify-between gap-2 text-sm"
        aria-hidden
      >
        <span className="min-w-0 font-semibold text-foreground tabular-nums">
          {formatValue(v0)}
        </span>
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/90">
          —
        </span>
        <span className="min-w-0 text-right font-semibold text-foreground tabular-nums">
          {formatValue(v1)}
        </span>
      </div>
      <Slider
        id={id}
        min={min}
        max={max}
        step={step}
        value={[v0, v1]}
        onValueChange={(raw) => {
          const a = Math.min(raw[0] ?? min, raw[1] ?? max);
          const b = Math.max(raw[0] ?? min, raw[1] ?? max);
          onValueChange([a, b] as [number, number]);
        }}
        disabled={disabled || min >= max}
        minStepsBetweenThumbs={0}
        aria-labelledby={ariaLabelledBy}
      />
    </div>
  );
}
