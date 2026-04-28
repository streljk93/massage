"use client";

import { cn } from "@/shared/lib";

export function SpecialistOnboardingStepper({
  current,
  total,
  aria,
}: {
  current: number;
  total: number;
  aria: string;
}) {
  return (
    <div className="flex w-full max-w-md gap-1" role="list" aria-label={aria}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={`seg-${i}`}
          role="listitem"
          className={cn(
            "h-1.5 min-w-0 flex-1 rounded-full transition-colors",
            i < current ? "bg-foreground" : "bg-border",
          )}
        />
      ))}
    </div>
  );
}
