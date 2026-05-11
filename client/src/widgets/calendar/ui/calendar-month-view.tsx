import { parseISO } from "date-fns";
import { cn } from "@/shared/lib";
import {
  formatListingCalendarYmd,
  LISTING_DISPLAY_TZ,
  vnNoonUtcForCalendarYmd,
} from "@/shared/lib/datetime/vn-listing-datetime";
import type { CalendarEvent, ViewMode } from "../model/types";
import { getMonthGrid } from "../lib/calendar-date";
import { resolveEventTone } from "../lib/calendar-event-layout";
import { CALENDAR_GRID_STICKY_TOP_CLASS } from "../model/constants";

type CalendarMonthViewProps = {
  dayKey: string;
  todayKey: string;
  events: CalendarEvent[];
  fmtTime: (iso: string) => string;
  evTitle: (event: CalendarEvent) => string;
  onDayKeyChange: (key: string) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onEventClick?: (event: CalendarEvent) => void;
};

export function CalendarMonthView({
  dayKey,
  todayKey,
  events,
  fmtTime,
  evTitle,
  onDayKeyChange,
  onViewModeChange,
  onEventClick,
}: CalendarMonthViewProps) {
  const grid = getMonthGrid(dayKey);
  const monthStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: LISTING_DISPLAY_TZ,
    year: "numeric",
    month: "2-digit",
  }).format(vnNoonUtcForCalendarYmd(dayKey));
  const [cy, cm] = monthStr.split("-").map(Number);

  return (
    <div className="mx-4 mt-3 mb-4 flex flex-1 flex-col rounded-2xl border border-border/40 bg-card shadow-sm [overflow:clip]">
      <div
        className={cn(
          "sticky z-20 grid grid-cols-7 border-b border-border/30 bg-card",
          CALENDAR_GRID_STICKY_TOP_CLASS,
        )}
      >
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div
            key={d}
            className="border-r border-border/15 px-2 py-2.5 text-center last:border-r-0"
          >
            <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
              {d}
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-1 flex-col">
      {grid.map((week, wi) => (
        <div key={wi} className="grid flex-1 grid-cols-7 border-b border-border/15 last:border-b-0">
          {week.map((dk, di) => {
            if (!dk)
              return (
                <div
                  key={di}
                  className="min-h-[80px] border-r border-border/15 bg-muted/20 last:border-r-0"
                />
              );
            const [, , dd] = dk.split("-").map(Number);
            const isThisMonth =
              parseInt(dk.split("-")[1]!) === cm &&
              parseInt(dk.split("-")[0]!) === cy;
            const isTodayCell = dk === todayKey;
            const dayEvts = events.filter(
              (e) => formatListingCalendarYmd(parseISO(e.startsAt)) === dk,
            );
            const maxShow = 3;
            return (
              <div
                key={dk}
                className={cn(
                  "min-h-[80px] cursor-pointer border-r border-border/15 p-1.5 transition-colors last:border-r-0 hover:bg-muted/20",
                  !isThisMonth && "bg-muted/20 opacity-60",
                )}
                onClick={() => {
                  onDayKeyChange(dk);
                  onViewModeChange("day");
                }}
              >
                <div
                  className={cn(
                    "mb-1 flex size-6 items-center justify-center rounded-full text-xs font-bold",
                    isTodayCell ? "bg-primary text-primary-foreground" : "text-foreground",
                  )}
                >
                  {dd}
                </div>
                <div className="flex flex-col gap-0.5">
                  {dayEvts.slice(0, maxShow).map((ev) => {
                    const tone = resolveEventTone(ev);
                    return (
                      <div
                        key={ev.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick?.(ev);
                        }}
                        className={cn(
                          "truncate rounded border-l-2 px-1 py-0.5 text-[0.6rem] font-semibold leading-tight",
                          tone.bg,
                          tone.border,
                          tone.text,
                        )}
                      >
                        {fmtTime(ev.startsAt)} {evTitle(ev)}
                      </div>
                    );
                  })}
                  {dayEvts.length > maxShow ? (
                    <span className="px-1 text-[0.6rem] font-medium text-muted-foreground">
                      +{dayEvts.length - maxShow}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ))}
      </div>
    </div>
  );
}
