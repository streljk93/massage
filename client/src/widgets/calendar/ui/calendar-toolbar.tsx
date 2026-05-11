import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/shared/ui";
import { cn } from "@/shared/lib";
import type { ViewMode } from "../model/types";
import { VIEW_MODES } from "../model/constants";

type CalendarToolbarProps = {
  viewMode: ViewMode;
  dateLabelText: string;
  currentPeriodLabel: string;
  isCurrentPeriod: boolean;
  isFetching?: boolean;
  t: (key: string) => string;
  onViewModeChange: (mode: ViewMode) => void;
  onShiftPeriod: (delta: number) => void;
  onGoCurrentPeriod: () => void;
};

export function CalendarToolbar({
  viewMode,
  dateLabelText,
  currentPeriodLabel,
  isCurrentPeriod,
  isFetching,
  t,
  onViewModeChange,
  onShiftPeriod,
  onGoCurrentPeriod,
}: CalendarToolbarProps) {
  return (
    <div className="sticky top-0 z-30 border-b border-border/10 bg-background/95 backdrop-blur-sm">
      {/*
       * Mobile:  два ряда — вкладки / навигация по датам
       * Desktop: один ряд — [вкладки] [← дата →] [Today] [индикатор]
       */}
      <div className="flex flex-col gap-0 px-4 pt-2.5 pb-2.5 lg:flex-row lg:items-center lg:gap-3 lg:py-2">

        {/* Вкладки режима просмотра */}
        <div className="flex min-w-0 gap-1 rounded-xl bg-muted/50 p-1 lg:shrink">
          {VIEW_MODES.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onViewModeChange(v)}
              className={cn(
                "flex h-9 min-h-9 flex-1 items-center justify-center rounded-lg px-3 text-sm font-semibold whitespace-nowrap transition-all",
                "sm:px-4 lg:flex-none lg:px-5",
                v === viewMode
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`view${v.charAt(0).toUpperCase()}${v.slice(1)}`)}
            </button>
          ))}
        </div>

        {/* Навигация по датам + кнопка "Сегодня" */}
        <div className="mt-2 flex items-center gap-2 lg:mt-0 lg:flex-1 lg:justify-end">
          <div className="flex flex-1 items-center rounded-xl bg-card lg:w-52 lg:flex-none">
            <button
              type="button"
              aria-label={t("previousPeriod")}
              onClick={() => onShiftPeriod(-1)}
              className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground active:bg-muted"
            >
              <ChevronLeft className="size-4" />
            </button>

            <div className="flex flex-1 items-center justify-center py-1.5">
              <span className="truncate text-sm font-medium leading-none text-foreground">
                {dateLabelText}
              </span>
            </div>

            <button
              type="button"
              aria-label={t("nextPeriod")}
              onClick={() => onShiftPeriod(1)}
              className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground active:bg-muted"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <Button
            type="button"
            variant="secondary"
            tone="light"
            size="sm"
            className="h-9 shrink-0 rounded-xl px-3 text-sm font-semibold"
            disabled={isCurrentPeriod}
            onClick={onGoCurrentPeriod}
          >
            {currentPeriodLabel}
          </Button>

          {isFetching ? (
            <span className="inline-block size-2 shrink-0 animate-pulse rounded-full bg-muted-foreground/40" />
          ) : null}
        </div>

      </div>
    </div>
  );
}
