import { Calendar } from "lucide-react";
import { parseISO } from "date-fns";
import { BusinessEmptyState } from "@/entities/business";
import { cn } from "@/shared/lib";
import {
  formatListingCalendarYmd,
  LISTING_DISPLAY_TZ,
  vnNoonUtcForCalendarYmd,
} from "@/shared/lib/datetime/vn-listing-datetime";
import type { CalendarEvent } from "../model/types";
import { resolveEventTone } from "../lib/calendar-event-layout";

type CalendarListViewProps = {
  events: CalendarEvent[];
  todayKey: string;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
  formatDateTime: (
    date: Date,
    options:
      | { day: "numeric"; timeZone: string }
      | { weekday: "long"; month: "long"; timeZone: string },
  ) => string;
  fmtTime: (iso: string) => string;
  evTitle: (event: CalendarEvent) => string;
  evSubtitle: (event: CalendarEvent) => string | null;
  onEventClick?: (event: CalendarEvent) => void;
};

export function CalendarListView({
  events,
  todayKey,
  t,
  formatDateTime,
  fmtTime,
  evTitle,
  evSubtitle,
  onEventClick,
}: CalendarListViewProps) {
  const sortedEvents = [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  if (sortedEvents.length === 0)
    return (
      <div className="flex flex-1 px-4 pt-3">
        <BusinessEmptyState
          icon={Calendar}
          title={t("emptyTitle")}
          description={t("emptyHint")}
        />
      </div>
    );

  const grouped = new Map<string, CalendarEvent[]>();
  for (const ev of sortedEvents) {
    const dk = formatListingCalendarYmd(parseISO(ev.startsAt));
    if (!grouped.has(dk)) grouped.set(dk, []);
    grouped.get(dk)!.push(ev);
  }

  return (
    <div className="mx-4 mt-3 flex flex-col gap-4">
      {Array.from(grouped.entries()).map(([dk, dayEvts]) => (
        <div key={dk}>
          <div className="mb-2 flex items-center gap-2">
            <div
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-sm font-bold",
                dk === todayKey ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
              )}
            >
              {formatDateTime(vnNoonUtcForCalendarYmd(dk), {
                day: "numeric",
                timeZone: LISTING_DISPLAY_TZ,
              })}
            </div>
            <p className="text-sm font-semibold text-foreground">
              {formatDateTime(vnNoonUtcForCalendarYmd(dk), {
                weekday: "long",
                month: "long",
                timeZone: LISTING_DISPLAY_TZ,
              })}
              {dk === todayKey ? (
                <span className="ml-2 text-[0.65rem] font-semibold uppercase text-primary">
                  {t("today")}
                </span>
              ) : null}
            </p>
          </div>
          <ul className="flex flex-col gap-2 pl-9">
            {dayEvts.map((ev) => {
              const tone = resolveEventTone(ev);
              const dur = Math.round(
                (parseISO(ev.endsAt).getTime() - parseISO(ev.startsAt).getTime()) /
                  60_000,
              );
              return (
                <li
                  key={ev.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onEventClick?.(ev)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onEventClick?.(ev);
                  }}
                  className="flex cursor-pointer items-stretch overflow-hidden rounded-xl border border-border/40 bg-card shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className={cn("w-1 shrink-0", tone.dot)} />
                  <div className="flex-1 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={cn("size-2 shrink-0 rounded-full", tone.dot)} />
                      <p className={cn("truncate text-sm font-semibold", tone.text)}>
                        {evTitle(ev)}
                      </p>
                    </div>
                    {evSubtitle(ev) ? (
                      <p className="ml-4 mt-0.5 truncate text-xs text-muted-foreground">
                        {evSubtitle(ev)}
                      </p>
                    ) : null}
                    <p className="ml-4 mt-1 text-xs tabular-nums text-muted-foreground">
                      {fmtTime(ev.startsAt)} — {fmtTime(ev.endsAt)} ·{" "}
                      {t("durationMin", { value: dur })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
