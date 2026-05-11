import { HOURS } from "../model/constants";

export function CalendarSkeleton() {
  return (
    <div className="mx-4 animate-pulse overflow-hidden rounded-2xl border border-border/40 bg-card shadow-sm">
      <div className="flex gap-3 border-b border-border/20 p-3">
        {[56, 100, 80, 56].map((w, i) => (
          <div key={i} className="h-7 rounded-xl bg-muted" style={{ width: w }} />
        ))}
      </div>
      <div className="flex">
        <div className="w-14 space-y-8 border-r border-border/20 p-2">
          {Array.from({ length: Math.min(7, HOURS.length) }).map((_, i) => (
            <div key={i} className="h-3 w-10 rounded bg-muted" />
          ))}
        </div>
        <div className="flex-1 space-y-4 p-4">
          {[52, 36, 96, 28, 64].map((h, i) => (
            <div key={i} className="rounded-xl bg-muted" style={{ height: h }} />
          ))}
        </div>
      </div>
    </div>
  );
}
