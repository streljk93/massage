import { Star } from "lucide-react";
import { cn } from "../lib";

export type RatingProps = {
  value: number;
  max?: number;
  className?: string;
};

export function Rating({ value, max = 5, className }: RatingProps) {
  const clamped = Math.min(max, Math.max(0, value));
  const full = Math.floor(clamped);
  const hasHalf = clamped - full >= 0.5 && full < max;

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="flex items-center" aria-hidden>
        {Array.from({ length: max }, (_, i) => {
          if (i < full) {
            return (
              <Star
                key={i}
                className="size-3.5 fill-amber-400 text-amber-400 sm:size-4"
                strokeWidth={0}
              />
            );
          }
          if (i === full && hasHalf) {
            return (
              <span key={i} className="relative size-3.5 sm:size-4">
                <Star className="absolute size-3.5 text-muted-foreground/35 sm:size-4" />
                <span className="absolute inset-0 overflow-hidden w-1/2">
                  <Star
                    className="size-3.5 fill-amber-400 text-amber-400 sm:size-4"
                    strokeWidth={0}
                  />
                </span>
              </span>
            );
          }
          return (
            <Star
              key={i}
              className="size-3.5 text-muted-foreground/35 sm:size-4"
            />
          );
        })}
      </div>
      <span className="text-sm text-muted-foreground tabular-nums">
        {clamped.toFixed(1)}
      </span>
    </div>
  );
}
