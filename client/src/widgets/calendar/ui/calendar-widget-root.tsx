"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, parseISO } from "date-fns";
import { useFormatter, useTranslations } from "next-intl";
import {
  formatListingCalendarYmd,
  LISTING_DISPLAY_TZ,
  vnNoonUtcForCalendarYmd,
} from "@/shared/lib/datetime/vn-listing-datetime";
import type { CalendarEvent, CalendarWidgetProps } from "../model/types";
import { CalendarSkeleton } from "./calendar-skeleton";
import { CalendarToolbar } from "./calendar-toolbar";
import {
  CalendarTimeGrid,
  type CalendarGridColumn,
} from "./calendar-time-grid";
import { CalendarMonthView } from "./calendar-month-view";
import { CalendarListView } from "./calendar-list-view";
import { getWeekDays, minutesFromDayStart } from "../lib/calendar-date";
import { HOUR_HEIGHT_PX, HOURS } from "../model/constants";

export function CalendarWidget({
  resources,
  events,
  isLoading,
  isFetching,
  viewMode,
  onViewModeChange,
  dayKey,
  onDayKeyChange,
  selectedResourceId,
  onSelectedResourceIdChange,
  todayKey,
  onEventClick,
  onCreateBlock,
}: CalendarWidgetProps) {
  const t = useTranslations("calendarWidget");
  const format = useFormatter();
  const [nowMin, setNowMin] = useState(() => minutesFromDayStart(new Date()));

  useEffect(() => {
    const id = setInterval(
      () => setNowMin(minutesFromDayStart(new Date())),
      30_000,
    );
    return () => clearInterval(id);
  }, []);

  const isToday = dayKey === todayKey;
  const nowPx = (nowMin / 60) * HOUR_HEIGHT_PX;
  const nowVisible = nowMin >= 0 && nowMin <= HOURS.length * 60;

  const weekDays = useMemo(
    () => (viewMode === "week" ? getWeekDays(dayKey) : []),
    [viewMode, dayKey],
  );

  const isCurrentPeriod = useMemo(() => {
    if (viewMode === "day") return dayKey === todayKey;
    if (viewMode === "week") return weekDays.includes(todayKey);
    return dayKey.slice(0, 7) === todayKey.slice(0, 7);
  }, [viewMode, dayKey, weekDays, todayKey]);

  const currentPeriodLabel =
    viewMode === "day"
      ? t("today")
      : viewMode === "week"
        ? t("thisWeek")
        : t("thisMonth");

  function shiftPeriod(delta: number) {
    if (viewMode === "week") {
      onDayKeyChange(
        formatListingCalendarYmd(
          addDays(vnNoonUtcForCalendarYmd(dayKey), delta * 7),
        ),
      );
      return;
    }
    if (viewMode === "month" || viewMode === "list") {
      const noon = vnNoonUtcForCalendarYmd(dayKey);
      const monthStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: LISTING_DISPLAY_TZ,
        year: "numeric",
        month: "2-digit",
      }).format(noon);
      const [y, m] = monthStr.split("-").map(Number);
      const newDate = new Date(y!, m! + delta - 1, 1);
      onDayKeyChange(
        `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, "0")}-01`,
      );
      return;
    }
    onDayKeyChange(
      formatListingCalendarYmd(addDays(vnNoonUtcForCalendarYmd(dayKey), delta)),
    );
  }

  function fmtTime(iso: string) {
    return format.dateTime(parseISO(iso), {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: LISTING_DISPLAY_TZ,
    });
  }

  function evTitle(event: CalendarEvent) {
    if (event.type === "booking")
      return (
        event.booking?.clientDisplayName ??
        event.booking?.categoryShortName ??
        t("booking")
      );
    return t(`blockReason.${event.blockReason ?? "manual"}`);
  }

  function evSubtitle(event: CalendarEvent) {
    if (event.type === "booking") {
      return event.booking?.categoryShortName ?? null;
    }
    return null;
  }

  const gridColumns = useMemo<CalendarGridColumn[]>(() => {
    if (viewMode === "day") {
      const filtered =
        selectedResourceId === "all"
          ? resources
          : resources.filter((r) => r.id === selectedResourceId);
      return filtered.map((r) => ({
        key: r.id,
        resourceId: r.id,
        colDayKey: dayKey,
        isToday,
        colEvents: events.filter((e) =>
          e.resources.some((er) => er.id === r.id),
        ),
        label: r.name,
        sublabel: null,
      }));
    }
    return weekDays.map((dk) => {
      const filtered = events.filter((e) => {
        const eDayKey = formatListingCalendarYmd(parseISO(e.startsAt));
        if (eDayKey !== dk) return false;
        if (selectedResourceId !== "all")
          return e.resources.some((er) => er.id === selectedResourceId);
        return true;
      });
      return {
        key: dk,
        resourceId:
          selectedResourceId !== "all"
            ? selectedResourceId
            : (resources[0]?.id ?? ""),
        colDayKey: dk,
        isToday: dk === todayKey,
        colEvents: filtered,
        label: format.dateTime(vnNoonUtcForCalendarYmd(dk), {
          weekday: "short",
          timeZone: LISTING_DISPLAY_TZ,
        }),
        sublabel: format.dateTime(vnNoonUtcForCalendarYmd(dk), {
          day: "numeric",
          timeZone: LISTING_DISPLAY_TZ,
        }),
      };
    });
  }, [
    viewMode,
    resources,
    events,
    selectedResourceId,
    dayKey,
    weekDays,
    todayKey,
    isToday,
    format,
  ]);

  const dateLabelText = useMemo(() => {
    if (viewMode === "week" && weekDays.length > 0) {
      return t("weekRange", {
        from: format.dateTime(vnNoonUtcForCalendarYmd(weekDays[0]!), {
          day: "numeric",
          month: "short",
          timeZone: LISTING_DISPLAY_TZ,
        }),
        to: format.dateTime(vnNoonUtcForCalendarYmd(weekDays[6]!), {
          day: "numeric",
          month: "short",
          timeZone: LISTING_DISPLAY_TZ,
        }),
      });
    }
    if (viewMode === "month" || viewMode === "list") {
      return format.dateTime(vnNoonUtcForCalendarYmd(dayKey), {
        month: "long",
        year: "numeric",
        timeZone: LISTING_DISPLAY_TZ,
      });
    }
    return format.dateTime(vnNoonUtcForCalendarYmd(dayKey), {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: LISTING_DISPLAY_TZ,
    });
  }, [viewMode, dayKey, weekDays, format, t]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CalendarToolbar
        viewMode={viewMode}
        dateLabelText={dateLabelText}
        currentPeriodLabel={currentPeriodLabel}
        isCurrentPeriod={isCurrentPeriod}
        isFetching={isFetching}
        t={t}
        onViewModeChange={onViewModeChange}
        onShiftPeriod={shiftPeriod}
        onGoCurrentPeriod={() => onDayKeyChange(todayKey)}
      />

      {isLoading ? (
        <div className="pt-3">
          <CalendarSkeleton />
        </div>
      ) : null}

      {!isLoading && (viewMode === "day" || viewMode === "week") ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <CalendarTimeGrid
            viewMode={viewMode}
            dayKey={dayKey}
            resources={resources}
            gridColumns={gridColumns}
            selectedResourceId={selectedResourceId}
            nowMin={nowMin}
            nowPx={nowPx}
            nowVisible={nowVisible}
            isToday={isToday}
            t={t}
            fmtTime={fmtTime}
            evTitle={evTitle}
            evSubtitle={evSubtitle}
            onSelectedResourceIdChange={onSelectedResourceIdChange}
            onEventClick={onEventClick}
            onCreateBlock={onCreateBlock}
          />
        </div>
      ) : null}

      {!isLoading && viewMode === "month" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <CalendarMonthView
            dayKey={dayKey}
            todayKey={todayKey}
            events={events}
            fmtTime={fmtTime}
            evTitle={evTitle}
            onDayKeyChange={onDayKeyChange}
            onViewModeChange={onViewModeChange}
            onEventClick={onEventClick}
          />
        </div>
      ) : null}

      {!isLoading && viewMode === "list" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <CalendarListView
            events={events}
            todayKey={todayKey}
            t={t}
            formatDateTime={(date, options) => format.dateTime(date, options)}
            fmtTime={fmtTime}
            evTitle={evTitle}
            evSubtitle={evSubtitle}
            onEventClick={onEventClick}
          />
        </div>
      ) : null}
    </div>
  );
}
