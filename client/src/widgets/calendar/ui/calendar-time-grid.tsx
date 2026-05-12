import { useRef, type MouseEvent } from "react";
import { Plus } from "lucide-react";
import { parseISO } from "date-fns";
import { cn } from "@/shared/lib";
import { Button } from "@/shared/ui";
import {
  CALENDAR_GRID_STICKY_TOP_CLASS,
  COL_MIN_W_DAY,
  COL_MIN_W_WEEK,
  DOT_COLORS,
  HOUR_HEIGHT_PX,
  HOURS,
  TIME_COL_W,
  TOTAL_GRID_H,
} from "../model/constants";
import type {
  CalendarEvent,
  CalendarResource,
  CalendarUnavailableRange,
  ViewMode,
} from "../model/types";
import {
  buildBlockTimes,
  minToHHMM,
  minutesFromDayStart,
  snapMinutes,
} from "../lib/calendar-date";
import {
  clusterOverlappingEvents,
  assignLaneLayout,
  resolveEventTone,
} from "../lib/calendar-event-layout";

export type CalendarGridColumn = {
  key: string;
  resourceId: string;
  colDayKey: string;
  isToday: boolean;
  colEvents: CalendarEvent[];
  colUnavailableRanges: CalendarUnavailableRange[];
  label: string;
  sublabel: string | null;
};

type CalendarTimeGridProps = {
  viewMode: Extract<ViewMode, "day" | "week">;
  dayKey: string;
  resources: CalendarResource[];
  gridColumns: CalendarGridColumn[];
  selectedResourceId: string;
  nowMin: number;
  nowPx: number;
  nowVisible: boolean;
  isToday: boolean;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
  fmtTime: (iso: string) => string;
  evTitle: (event: CalendarEvent) => string;
  evSubtitle: (event: CalendarEvent) => string | null;
  onSelectedResourceIdChange: (id: string) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onCreateBlock?: (
    resourceId: string,
    dayKey: string,
    startHHMM: string,
    endHHMM: string,
  ) => void;
};

export function CalendarTimeGrid({
  viewMode,
  dayKey,
  resources,
  gridColumns,
  selectedResourceId,
  nowMin,
  nowPx,
  nowVisible,
  isToday,
  t,
  fmtTime,
  evTitle,
  evSubtitle,
  onSelectedResourceIdChange,
  onEventClick,
  onCreateBlock,
}: CalendarTimeGridProps) {
  const colMinW = viewMode === "week" ? COL_MIN_W_WEEK : COL_MIN_W_DAY;
  const totalGridW = TIME_COL_W + gridColumns.length * colMinW;

  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);

  function syncHeaderScroll() {
    if (headerScrollRef.current && bodyScrollRef.current) {
      headerScrollRef.current.scrollLeft = bodyScrollRef.current.scrollLeft;
    }
  }

  function openCreateBlock(
    resourceId: string,
    targetDayKey: string,
    startMin: number,
  ) {
    const times = buildBlockTimes(startMin);
    onCreateBlock?.(resourceId, targetDayKey, times.startHHMM, times.endHHMM);
  }

  function triggerAddBlock(resourceId: string, targetDayKey: string) {
    const defaultMin = isToday && nowMin > 0 ? snapMinutes(nowMin) : 9 * 60;
    const times = buildBlockTimes(defaultMin);
    onCreateBlock?.(resourceId, targetDayKey, times.startHHMM, times.endHHMM);
  }

  function handleColumnClick(
    e: MouseEvent<HTMLDivElement>,
    resourceId: string,
    colDayKey: string,
  ) {
    if ((e.target as HTMLElement).closest("[data-event]")) return;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    openCreateBlock(
      resourceId,
      colDayKey,
      Math.floor((y / HOUR_HEIGHT_PX) * 60),
    );
  }

  return (
    <div className="mx-4 mt-3 flex flex-col gap-2">
      {viewMode === "day" && resources.length > 1 ? (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => onSelectedResourceIdChange("all")}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
              selectedResourceId === "all"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/50 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {t("allResources")}
          </button>
          {resources.map((r, idx) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelectedResourceIdChange(r.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                selectedResourceId === r.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/50 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  DOT_COLORS[idx % DOT_COLORS.length],
                )}
              />
              {r.name}
            </button>
          ))}
        </div>
      ) : null}

      {/*
       * [overflow:clip] клипает контент по rounded-2xl без создания scroll-контекста.
       * Это позволяет sticky внутри (заголовок) работать относительно viewport, а не контейнера.
       */}
      <div className="rounded-2xl border border-border/40 bg-card shadow-sm [overflow:clip]">
        {/* Заголовок колонок — sticky под тулбаром, горизонтальный скролл синхронизируется с телом */}
        <div
          ref={headerScrollRef}
          className={cn(
            "sticky z-20 overflow-x-hidden border-b border-border/30 bg-card/95",
            CALENDAR_GRID_STICKY_TOP_CLASS,
          )}
        >
          <div className="flex" style={{ minWidth: totalGridW }}>
            <div
              className="shrink-0 border-r border-border/20"
              style={{ width: TIME_COL_W }}
            />

            {gridColumns.map((col, idx) => (
              <div
                key={col.key}
                className={cn(
                  "flex flex-1 items-center justify-between gap-2 border-r border-border/20 px-3 py-2.5 last:border-r-0",
                  col.isToday && "bg-primary/5",
                )}
                style={{ minWidth: colMinW }}
              >
                {viewMode === "day" ? (
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <div
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        DOT_COLORS[idx % DOT_COLORS.length],
                      )}
                    />
                    <p className="truncate text-sm font-semibold text-foreground">
                      {col.label}
                    </p>
                  </div>
                ) : (
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
                    <p
                      className={cn(
                        "text-[0.65rem] font-semibold uppercase tracking-wide",
                        col.isToday ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {col.label}
                    </p>
                    <div
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full text-xs font-bold",
                        col.isToday
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground",
                      )}
                    >
                      {col.sublabel}
                    </div>
                  </div>
                )}
                {viewMode === "day" ? (
                  <button
                    type="button"
                    title={t("addBlock")}
                    onClick={() => triggerAddBlock(col.resourceId, dayKey)}
                    className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Plus className="size-3.5" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {/* Тело грида — горизонтальный скролл, синхронизируется с заголовком */}
        <div
          ref={bodyScrollRef}
          className="overflow-x-auto"
          onScroll={syncHeaderScroll}
        >
          <div style={{ minWidth: totalGridW }}>
            <div className="flex">
              <div
                className="sticky left-0 z-10 shrink-0 border-r border-border/20 bg-card"
                style={{ width: TIME_COL_W, height: TOTAL_GRID_H }}
              >
                {HOURS.map((hour, i) => (
                  <div
                    key={hour}
                    className="relative"
                    style={{ height: HOUR_HEIGHT_PX }}
                  >
                    {i > 0 && (
                      <div className="absolute left-0 right-0 top-0 border-t border-border/20" />
                    )}
                    <span
                      className={cn(
                        "absolute right-2 select-none text-[0.65rem] font-medium tabular-nums leading-none",
                        nowVisible && isToday && Math.abs(nowMin - i * 60) < 20
                          ? "text-red-500"
                          : "text-muted-foreground/60",
                      )}
                      style={{ top: i === 0 ? "0.25rem" : "-0.5rem" }}
                    >
                      {String(hour).padStart(2, "0")}:00
                    </span>
                  </div>
                ))}

                {nowVisible && isToday ? (
                  <div
                    className="pointer-events-none absolute left-0 right-1 z-20 flex items-center justify-end"
                    style={{ top: nowPx - 9 }}
                  >
                    <span className="rounded bg-red-500 px-1 py-0.5 text-[0.6rem] font-bold leading-none text-white tabular-nums shadow">
                      {minToHHMM(Math.max(0, nowMin))}
                    </span>
                  </div>
                ) : null}
              </div>

              {gridColumns.map((col, idx) => {
                const clusters = clusterOverlappingEvents(col.colEvents);
                return (
                  <div
                    key={col.key}
                    className={cn(
                      "relative flex-1 cursor-crosshair border-r border-border/20 last:border-r-0",
                      col.isToday && "bg-primary/[0.015]",
                    )}
                    style={{ height: TOTAL_GRID_H, minWidth: colMinW }}
                    onClick={(e) =>
                      handleColumnClick(e, col.resourceId, col.colDayKey)
                    }
                  >
                    {HOURS.map((_, i) => (
                      <div
                        key={i}
                        className="pointer-events-none absolute left-0 right-0 border-t border-border/20"
                        style={{ top: i * HOUR_HEIGHT_PX }}
                      />
                    ))}
                    {HOURS.map((_, i) => (
                      <div
                        key={`hh${i}`}
                        className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-border/[0.12]"
                        style={{ top: i * HOUR_HEIGHT_PX + HOUR_HEIGHT_PX / 2 }}
                      />
                    ))}

                    {col.colUnavailableRanges.map((range) => {
                      const startMin = minutesFromDayStart(
                        parseISO(range.startsAt),
                      );
                      const dur = Math.round(
                        (parseISO(range.endsAt).getTime() -
                          parseISO(range.startsAt).getTime()) /
                          60_000,
                      );
                      const topPx = Math.max(
                        0,
                        (startMin / 60) * HOUR_HEIGHT_PX,
                      );
                      const heightPx = Math.max(
                        18,
                        (dur / 60) * HOUR_HEIGHT_PX,
                      );

                      return (
                        <div
                          key={range.id}
                          className="pointer-events-none absolute left-1 right-1 overflow-hidden rounded-md border border-dashed border-muted-foreground/20 bg-muted/35 text-muted-foreground/70"
                          style={{
                            top: topPx + 1,
                            height: heightPx - 2,
                            zIndex: 2,
                          }}
                          title={range.label}
                        >
                          {heightPx >= 34 ? (
                            <div className="flex h-full items-center justify-center px-1 text-center text-[0.62rem] font-medium leading-tight">
                              <span className="line-clamp-2">
                                {range.label}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}

                    {clusters.flatMap((cluster) => {
                      const laneById = assignLaneLayout(cluster);
                      return cluster.map((event) => {
                        const startMin = minutesFromDayStart(
                          parseISO(event.startsAt),
                        );
                        const dur = Math.round(
                          (parseISO(event.endsAt).getTime() -
                            parseISO(event.startsAt).getTime()) /
                            60_000,
                        );
                        const topPx = Math.max(
                          0,
                          (startMin / 60) * HOUR_HEIGHT_PX,
                        );
                        const heightPx = Math.max(
                          22,
                          (dur / 60) * HOUR_HEIGHT_PX,
                        );
                        const tone = resolveEventTone(event);
                        const isCompact = heightPx < 44;
                        const title = evTitle(event);
                        const subtitle = evSubtitle(event);
                        const layout = laneById.get(event.id)!;
                        const { lane, laneCount, span } = layout;
                        const gap = 2;
                        const n = Math.max(1, laneCount);
                        const widthExpr =
                          n === 1
                            ? "calc(100% - 6px)"
                            : `calc(${span} * ((100% - 6px - ${(n - 1) * gap}px) / ${n}) + ${(span - 1) * gap}px)`;
                        const leftExpr =
                          n === 1
                            ? "3px"
                            : `calc(3px + ${lane} * ((100% - 6px - ${(n - 1) * gap}px) / ${n} + ${gap}px))`;
                        return (
                          <div
                            key={event.id}
                            data-event
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEventClick?.(event);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.stopPropagation();
                                onEventClick?.(event);
                              }
                            }}
                            className={cn(
                              "absolute cursor-pointer overflow-hidden rounded-md border-l-[3px]",
                              "shadow-sm ring-1 ring-inset ring-black/[0.04]",
                              "transition-shadow hover:z-[28] hover:shadow-md",
                              tone.bg,
                              tone.border,
                              tone.text,
                            )}
                            style={{
                              top: topPx + 1,
                              height: heightPx - 2,
                              left: leftExpr,
                              width: widthExpr,
                              zIndex: 12 + laneCount - lane,
                            }}
                            title={`${title} · ${fmtTime(event.startsAt)}–${fmtTime(event.endsAt)}`}
                          >
                            <div className="flex h-full flex-col px-2 py-1">
                              {isCompact ? (
                                <p className="truncate text-[0.65rem] font-semibold leading-tight">
                                  {fmtTime(event.startsAt)} · {title}
                                </p>
                              ) : (
                                <>
                                  <p className="flex items-center justify-between gap-2 text-[0.62rem] font-medium opacity-60">
                                    <span className="truncate tabular-nums">
                                      {fmtTime(event.startsAt)} —{" "}
                                      {fmtTime(event.endsAt)}
                                    </span>
                                    {event.type === "block" &&
                                    event.createdByDisplayName != null &&
                                    event.createdByDisplayName.trim().length >
                                      0 ? (
                                      <span className="min-w-0 truncate text-right">
                                        {t("author", {
                                          name: event.createdByDisplayName,
                                        })}
                                      </span>
                                    ) : null}
                                  </p>
                                  <p className="mt-0.5 truncate text-[0.75rem] font-semibold leading-snug">
                                    {title}
                                  </p>
                                  {subtitle && heightPx >= 72 ? (
                                    <p className="mt-0.5 truncate text-[0.65rem] opacity-55">
                                      {subtitle}
                                    </p>
                                  ) : null}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })}

                    {nowVisible &&
                    isToday &&
                    (viewMode === "day" || col.isToday) ? (
                      <div
                        className="pointer-events-none absolute left-0 right-0 z-10"
                        style={{ top: nowPx }}
                      >
                        <div className="relative border-t-2 border-red-500">
                          {idx === 0 ? (
                            <div className="absolute -left-0.5 -top-[5px] size-2.5 rounded-full bg-red-500 shadow" />
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-20 right-4 z-20 md:hidden">
        <Button
          type="button"
          className="size-14 rounded-full shadow-lg"
          aria-label={t("addBlock")}
          onClick={() => {
            const activeId =
              selectedResourceId === "all"
                ? (resources[0]?.id ?? "")
                : selectedResourceId;
            triggerAddBlock(activeId, dayKey);
          }}
        >
          <Plus className="size-6" />
        </Button>
      </div>
    </div>
  );
}
