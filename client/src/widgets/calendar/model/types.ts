import type {
  CalendarListEventsResponse,
  CalendarListResourcesResponse,
} from "@/shared/api/generated/sdk/types.gen";

export type ViewMode = "day" | "week" | "month" | "list";

export type CalendarResource = CalendarListResourcesResponse["resources"][number];
export type CalendarEvent = CalendarListEventsResponse["events"][number];

export type CalendarUnavailableRange = {
  id: string;
  resourceId: string;
  dayKey: string;
  startsAt: string;
  endsAt: string;
  label: string;
};

export interface CalendarWidgetProps {
  resources: CalendarResource[];
  events: CalendarEvent[];
  unavailableRanges?: CalendarUnavailableRange[];
  isLoading?: boolean;
  isFetching?: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  dayKey: string;
  onDayKeyChange: (key: string) => void;
  selectedResourceId: string;
  onSelectedResourceIdChange: (id: string) => void;
  todayKey: string;
  /** Вызывается при клике на событие в сетке. */
  onEventClick?: (event: CalendarEvent) => void;
  /**
   * Вызывается при нажатии «+» или клике на пустой слот.
   * `startHHMM` / `endHHMM` — уже готовые строки «ЧЧ:ММ».
   */
  onCreateBlock?: (
    resourceId: string,
    dayKey: string,
    startHHMM: string,
    endHHMM: string,
  ) => void;
}
