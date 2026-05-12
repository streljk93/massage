"use client";

import { useCallback, useMemo, useState } from "react";
import { Calendar, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { addDays } from "date-fns";
import { parseISO } from "date-fns";
import type { AppLocale } from "@/app/i18n/routing";
import { BusinessEmptyState } from "@/entities/business";
import {
  BOOKING_CALENDAR_HIDDEN_STATUSES,
  isBookingStatus,
} from "@/entities/booking";
import {
  OrganizationBookingActions,
  OrganizationCalendarActions,
  OrganizationCapabilities,
  canOrganization,
  specialistMyOrganizationsQueryKey,
} from "@/entities/organizations";
import { useSetBusinessPageTitle } from "@/widgets/business/chrome";
import {
  calendarGetResourceAvailability,
  calendarListEvents,
  calendarListResources,
  createBrowserSdkClient,
  specialistsCabinetGetSpecialistMyOrganizations,
} from "@/shared/api";
import type {
  CalendarGetResourceAvailabilityResponse,
  CalendarListEventsResponse,
  CalendarListResourcesResponse,
} from "@/shared/api/generated/sdk/types.gen";
import {
  formatListingCalendarYmd,
  LISTING_DISPLAY_TZ,
  vnNoonUtcForCalendarYmd,
  vnWallClockToUtcDate,
} from "@/shared/lib/datetime/vn-listing-datetime";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CalendarUnavailableRange, ViewMode } from "@/widgets/calendar";
import { CalendarWidget } from "@/widgets/calendar";
import {
  BusinessCalendarBlockDialog,
  type CalendarBlockDialogState,
  type CalendarEvent,
} from "./business-calendar-block-dialog";
import { BusinessCalendarBookingDetail } from "./business-calendar-booking-detail";

// ─── Query keys ───────────────────────────────────────────────────

const RESOURCES_QK = ["businessCalendarResources"] as const;
const EVENTS_QK = ["businessCalendarEvents"] as const;
const AVAILABILITY_QK = ["businessCalendarAvailability"] as const;

// ─── Date range helpers ───────────────────────────────────────────

function dayRangeUtc(key: string): { from: string; to: string } {
  const [y, m, d] = key.split("-").map(Number);
  const next = formatListingCalendarYmd(
    addDays(vnNoonUtcForCalendarYmd(key), 1),
  );
  const [ny, nm, nd] = next.split("-").map(Number);
  return {
    from: vnWallClockToUtcDate(y!, m!, d!, 0, 0).toISOString(),
    to: vnWallClockToUtcDate(ny!, nm!, nd!, 0, 0).toISOString(),
  };
}

function weekRangeUtc(mondayKey: string): { from: string; to: string } {
  const [y, m, d] = mondayKey.split("-").map(Number);
  const end = formatListingCalendarYmd(
    addDays(vnNoonUtcForCalendarYmd(mondayKey), 7),
  );
  const [ey, em, ed] = end.split("-").map(Number);
  return {
    from: vnWallClockToUtcDate(y!, m!, d!, 0, 0).toISOString(),
    to: vnWallClockToUtcDate(ey!, em!, ed!, 0, 0).toISOString(),
  };
}

function monthRangeUtc(dayKey: string): { from: string; to: string } {
  const noon = vnNoonUtcForCalendarYmd(dayKey);
  const monthStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: LISTING_DISPLAY_TZ,
    year: "numeric",
    month: "2-digit",
  }).format(noon);
  const [y, m] = monthStr.split("-").map(Number);
  const lastDay = new Date(y!, m!, 0).getDate();
  return {
    from: vnWallClockToUtcDate(y!, m!, 1, 0, 0).toISOString(),
    to: vnWallClockToUtcDate(y!, m!, lastDay, 23, 59).toISOString(),
  };
}

function getMondayKey(dayKey: string): string {
  const noon = vnNoonUtcForCalendarYmd(dayKey);
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: LISTING_DISPLAY_TZ,
    weekday: "short",
  }).format(noon);
  const dow: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const d = dow[short] ?? 1;
  const fromMon = d === 0 ? 6 : d - 1;
  return formatListingCalendarYmd(addDays(noon, -fromMon));
}

/** Скрываем только «отменённые» брони по доменному статусу. В API для `done` / no-show тоже приходит `status: cancelled` — это не отмена записи. */
function isHiddenCancelledBooking(ev: CalendarEvent): boolean {
  if (ev.type !== "booking") return false;
  const bs = ev.booking?.status;
  return (
    bs != null &&
    isBookingStatus(bs) &&
    BOOKING_CALENDAR_HIDDEN_STATUSES.has(bs)
  );
}

type MinuteInterval = { startMinute: number; endMinute: number };
type AvailabilityRule =
  CalendarGetResourceAvailabilityResponse["rules"][number];
type AvailabilityOverride =
  CalendarGetResourceAvailabilityResponse["overrides"][number];

function weekdayIndex(dayKey: string): number {
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: LISTING_DISPLAY_TZ,
    weekday: "short",
  }).format(vnNoonUtcForCalendarYmd(dayKey));
  const dow: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return dow[short] ?? 1;
}

function dayKeysForAvailability(viewMode: ViewMode, dayKey: string): string[] {
  if (viewMode === "week") {
    const monday = getMondayKey(dayKey);
    return Array.from({ length: 7 }, (_, i) =>
      formatListingCalendarYmd(addDays(vnNoonUtcForCalendarYmd(monday), i)),
    );
  }
  if (viewMode === "day") {
    return [dayKey];
  }
  return [];
}

function minuteToIso(dayKey: string, minute: number): string {
  const normalizedMinute = Math.max(0, Math.min(1440, minute));
  const targetDayKey =
    normalizedMinute >= 1440
      ? formatListingCalendarYmd(addDays(vnNoonUtcForCalendarYmd(dayKey), 1))
      : dayKey;
  const localMinute = normalizedMinute >= 1440 ? 0 : normalizedMinute;
  const [year, month, day] = targetDayKey.split("-").map(Number);
  return vnWallClockToUtcDate(
    year!,
    month!,
    day!,
    Math.floor(localMinute / 60),
    localMinute % 60,
  ).toISOString();
}

function instantMinuteOnDay(raw: string | null, dayKey: string, edge: "start" | "end") {
  if (raw == null) {
    return edge === "start" ? 0 : 1440;
  }
  const date = parseISO(raw);
  const instantDayKey = formatListingCalendarYmd(date);
  if (instantDayKey < dayKey) return 0;
  if (instantDayKey > dayKey) return 1440;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: LISTING_DISPLAY_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(date)
    .split(":")
    .map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

function mergeIntervals(intervals: MinuteInterval[]): MinuteInterval[] {
  const sorted = intervals
    .map((i) => ({
      startMinute: Math.max(0, Math.min(1440, i.startMinute)),
      endMinute: Math.max(0, Math.min(1440, i.endMinute)),
    }))
    .filter((i) => i.endMinute > i.startMinute)
    .sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);
  const merged: MinuteInterval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last == null || interval.startMinute > last.endMinute) {
      merged.push({ ...interval });
    } else {
      last.endMinute = Math.max(last.endMinute, interval.endMinute);
    }
  }
  return merged;
}

function subtractInterval(
  intervals: MinuteInterval[],
  cut: MinuteInterval,
): MinuteInterval[] {
  if (cut.endMinute <= cut.startMinute) return intervals;
  return intervals.flatMap((interval) => {
    if (
      cut.endMinute <= interval.startMinute ||
      cut.startMinute >= interval.endMinute
    ) {
      return [interval];
    }
    const next: MinuteInterval[] = [];
    if (cut.startMinute > interval.startMinute) {
      next.push({
        startMinute: interval.startMinute,
        endMinute: Math.min(cut.startMinute, interval.endMinute),
      });
    }
    if (cut.endMinute < interval.endMinute) {
      next.push({
        startMinute: Math.max(cut.endMinute, interval.startMinute),
        endMinute: interval.endMinute,
      });
    }
    return next;
  });
}

function complementIntervals(working: MinuteInterval[]): MinuteInterval[] {
  const merged = mergeIntervals(working);
  const unavailable: MinuteInterval[] = [];
  let cursor = 0;
  for (const interval of merged) {
    if (interval.startMinute > cursor) {
      unavailable.push({ startMinute: cursor, endMinute: interval.startMinute });
    }
    cursor = Math.max(cursor, interval.endMinute);
  }
  if (cursor < 1440) {
    unavailable.push({ startMinute: cursor, endMinute: 1440 });
  }
  return unavailable;
}

function overrideToInterval(
  override: AvailabilityOverride,
  dayKey: string,
): MinuteInterval {
  return {
    startMinute: instantMinuteOnDay(override.startsAt, dayKey, "start"),
    endMinute: instantMinuteOnDay(override.endsAt, dayKey, "end"),
  };
}

function buildUnavailableRangesForResource(args: {
  resourceId: string;
  availability: CalendarGetResourceAvailabilityResponse;
  dayKeys: string[];
  label: string;
}): CalendarUnavailableRange[] {
  const ranges: CalendarUnavailableRange[] = [];
  for (const dayKey of args.dayKeys) {
    const weekday = weekdayIndex(dayKey);
    const dayRules = args.availability.rules.filter(
      (rule: AvailabilityRule) => rule.weekday === weekday,
    );
    const dayOverrides = args.availability.overrides.filter(
      (override: AvailabilityOverride) => override.date === dayKey,
    );
    let working = mergeIntervals([
      ...dayRules
        .filter((rule) => rule.type === "working")
        .map((rule) => ({
          startMinute: rule.startMinute,
          endMinute: rule.endMinute,
        })),
      ...dayOverrides
        .filter((override) => override.type === "extra")
        .map((override) => overrideToInterval(override, dayKey)),
    ]);

    for (const interval of [
      ...dayRules
        .filter((rule) => rule.type === "break")
        .map((rule) => ({
          startMinute: rule.startMinute,
          endMinute: rule.endMinute,
        })),
      ...dayOverrides
        .filter((override) => override.type === "off")
        .map((override) => overrideToInterval(override, dayKey)),
    ]) {
      working = subtractInterval(working, interval);
    }

    complementIntervals(working).forEach((interval, idx) => {
      ranges.push({
        id: `${args.resourceId}:${dayKey}:${idx}:${interval.startMinute}-${interval.endMinute}`,
        resourceId: args.resourceId,
        dayKey,
        startsAt: minuteToIso(dayKey, interval.startMinute),
        endsAt: minuteToIso(dayKey, interval.endMinute),
        label: args.label,
      });
    });
  }
  return ranges;
}

// ─── Page component ───────────────────────────────────────────────

export function BusinessCalendarPage() {
  const t = useTranslations("businessCalendarPage");
  useSetBusinessPageTitle(t("title"));
  const locale = useLocale() as AppLocale;
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken ?? "";
  const authed = sessionStatus === "authenticated" && accessToken.length > 0;
  const queryClient = useQueryClient();

  const todayKey = useMemo(() => formatListingCalendarYmd(new Date()), []);
  const [dayKey, setDayKey] = useState(() =>
    formatListingCalendarYmd(new Date()),
  );
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [selectedResourceId, setSelectedResourceId] = useState<string>("all");
  const [dialogState, setDialogState] = useState<CalendarBlockDialogState>({
    type: "closed",
  });

  const sdk = useMemo(
    () => createBrowserSdkClient(accessToken, { locale }),
    [accessToken, locale],
  );

  const orgsQuery = useQuery({
    queryKey: specialistMyOrganizationsQueryKey(accessToken, locale),
    enabled: authed,
    queryFn: async () => {
      const { data: res, error: err } =
        await specialistsCabinetGetSpecialistMyOrganizations({
          client: sdk,
        });
      if (err || !res) {
        throw err ?? new Error("organizations");
      }
      return res;
    },
  });

  const activeWorkplace = useMemo(() => {
    const orgs = orgsQuery.data?.organizations ?? [];
    return orgs.find((o) => o.isActiveWorkplace === true) ?? null;
  }, [orgsQuery.data?.organizations]);

  const hasActiveWorkplace = activeWorkplace != null;
  const canViewActiveWorkplaceCalendar = canOrganization(
    activeWorkplace,
    OrganizationCapabilities.CALENDAR,
    { calendarAction: OrganizationCalendarActions.VIEW },
  );
  const canManageActiveWorkplaceCalendar = canOrganization(
    activeWorkplace,
    OrganizationCapabilities.CALENDAR,
    { calendarAction: OrganizationCalendarActions.MANAGE },
  );
  const canConfirmActiveWorkplaceBookings = canOrganization(
    activeWorkplace,
    OrganizationCapabilities.BOOKINGS,
    { bookingAction: OrganizationBookingActions.CONFIRM },
  );
  const canCancelActiveWorkplaceBookings = canOrganization(
    activeWorkplace,
    OrganizationCapabilities.BOOKINGS,
    { bookingAction: OrganizationBookingActions.CANCEL },
  );
  const canManageActiveWorkplaceBookings = canOrganization(
    activeWorkplace,
    OrganizationCapabilities.BOOKINGS,
    { bookingAction: OrganizationBookingActions.MANAGE },
  );

  const calendarApiEnabled =
    authed && orgsQuery.isSuccess && canViewActiveWorkplaceCalendar;

  // ── Диапазон дат для запроса ─────────────────────────────────
  const mondayKey = useMemo(
    () => (viewMode === "week" ? getMondayKey(dayKey) : dayKey),
    [viewMode, dayKey],
  );

  const queryRange = useMemo(() => {
    if (viewMode === "week") return weekRangeUtc(mondayKey);
    if (viewMode === "month" || viewMode === "list")
      return monthRangeUtc(dayKey);
    return dayRangeUtc(dayKey);
  }, [viewMode, dayKey, mondayKey]);

  const eventsQKey = useMemo(
    () => [
      ...EVENTS_QK,
      accessToken,
      locale,
      viewMode === "day"
        ? dayKey
        : viewMode === "week"
          ? mondayKey
          : `${viewMode}-${dayKey.slice(0, 7)}`,
    ],
    [accessToken, locale, viewMode, dayKey, mondayKey],
  );

  // ── Запросы ──────────────────────────────────────────────────
  const resourcesQuery = useQuery({
    queryKey: [...RESOURCES_QK, accessToken, locale],
    enabled: calendarApiEnabled,
    queryFn: async () => {
      const { data, error } = await calendarListResources({ client: sdk });
      if (error || !data) throw error ?? new Error("resources");
      return data as CalendarListResourcesResponse;
    },
  });

  const eventsQuery = useQuery({
    queryKey: eventsQKey,
    enabled: calendarApiEnabled,
    queryFn: async () => {
      const { data, error } = await calendarListEvents({
        client: sdk,
        query: { from: queryRange.from, to: queryRange.to, limit: 500 },
      });
      if (error || !data) throw error ?? new Error("events");
      return data as CalendarListEventsResponse;
    },
  });

  const resources = useMemo(
    () => resourcesQuery.data?.resources ?? [],
    [resourcesQuery.data],
  );
  const availabilityDayKeys = useMemo(
    () => dayKeysForAvailability(viewMode, dayKey),
    [viewMode, dayKey],
  );
  const availabilityQueries = useQueries({
    queries: resources.map((resource) => ({
      queryKey: [...AVAILABILITY_QK, accessToken, locale, resource.id],
      enabled: calendarApiEnabled && availabilityDayKeys.length > 0,
      queryFn: async () => {
        const { data, error } = await calendarGetResourceAvailability({
          client: sdk,
          path: { resourceId: resource.id },
        });
        if (error || !data) throw error ?? new Error("availability");
        return data as CalendarGetResourceAvailabilityResponse;
      },
    })),
  });
  const events = useMemo(() => {
    const raw = eventsQuery.data?.events ?? [];
    return raw.filter((e) => !isHiddenCancelledBooking(e));
  }, [eventsQuery.data]);
  const unavailableRanges = useMemo(
    () =>
      availabilityQueries.flatMap((query, index) => {
        const resource = resources[index];
        if (resource == null || query.data == null) return [];
        return buildUnavailableRangesForResource({
          resourceId: resource.id,
          availability: query.data,
          dayKeys: availabilityDayKeys,
          label: t("notWorking"),
        });
      }),
    [availabilityQueries, availabilityDayKeys, resources, t],
  );

  const orgsBlocking = authed && orgsQuery.isPending;
  const availabilityPending =
    availabilityDayKeys.length > 0 && availabilityQueries.some((q) => q.isPending);
  const calendarDataPending =
    calendarApiEnabled &&
    (resourcesQuery.isPending || eventsQuery.isPending || availabilityPending);
  const isLoading =
    sessionStatus === "loading" || orgsBlocking || calendarDataPending;
  const calendarLoadError =
    calendarApiEnabled &&
    (resourcesQuery.isError ||
      eventsQuery.isError ||
      availabilityQueries.some((q) => q.isError));
  const isFetching =
    calendarApiEnabled &&
    authed &&
    (resourcesQuery.isFetching ||
      eventsQuery.isFetching ||
      availabilityQueries.some((q) => q.isFetching)) &&
    !isLoading;

  // ── Коллбэки ─────────────────────────────────────────────────
  const handleEventsRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [...EVENTS_QK] });
  }, [queryClient]);

  const handleCreateBlock = useCallback(
    (
      resourceId: string,
      targetDayKey: string,
      startHHMM: string,
      endHHMM: string,
    ) => {
      setDialogState({
        type: "create",
        dayKey: targetDayKey,
        startHHMM,
        endHHMM,
        defaultResourceId: resourceId,
      });
    },
    [],
  );

  const handleEventClick = useCallback(
    (event: CalendarEvent) => {
      if (
        event.type === "block" &&
        canManageActiveWorkplaceCalendar &&
        event.permissions.manage
      ) {
        setDialogState({
          type: "edit",
          event,
          dayKey: formatListingCalendarYmd(parseISO(event.startsAt)),
        });
      } else if (event.type === "block") {
        setDialogState({ type: "closed" });
      } else {
        setDialogState({ type: "detail", event });
      }
    },
    [canManageActiveWorkplaceCalendar],
  );

  return (
    <main className="flex w-full flex-1 min-h-0 flex-col gap-0">
      {/* Требуется вход */}
      {!isLoading && (sessionStatus === "unauthenticated" || !accessToken) && (
        <div className="px-4 pt-3">
          <BusinessEmptyState
            icon={Calendar}
            title={t("signInTitle")}
            description={t("signInHint")}
          />
        </div>
      )}

      {/* Загрузка мест приёма */}
      {authed && orgsQuery.isPending && (
        <div
          className="flex flex-1 items-center justify-center gap-2 py-16 px-4 text-sm text-muted-foreground"
          aria-busy
          aria-label={t("loading")}
        >
          <Loader2 className="size-8 shrink-0 animate-spin" aria-hidden />
        </div>
      )}

      {/* Ошибка списка организаций */}
      {!orgsQuery.isPending && authed && orgsQuery.isError && (
        <div
          className="mx-4 mt-3 rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-4"
          role="alert"
        >
          <p className="font-medium">{t("orgsLoadErrorTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("orgsLoadErrorHint")}
          </p>
          <button
            type="button"
            className="mt-2 text-sm font-medium text-primary hover:underline"
            onClick={() => void orgsQuery.refetch()}
          >
            {t("retry")}
          </button>
        </div>
      )}

      {/* Нет текущего места приёма — календарь не запрашиваем */}
      {!orgsQuery.isPending &&
        authed &&
        orgsQuery.isSuccess &&
        !hasActiveWorkplace && (
          <div className="px-4 pt-3">
            <BusinessEmptyState
              icon={Calendar}
              title={t("emptyActiveWorkplaceTitle")}
              description={t("emptyActiveWorkplaceHint")}
            />
          </div>
        )}

      {!orgsQuery.isPending &&
        authed &&
        orgsQuery.isSuccess &&
        hasActiveWorkplace &&
        !canViewActiveWorkplaceCalendar && (
          <div className="px-4 pt-3">
            <BusinessEmptyState
              icon={Calendar}
              title={t("noCalendarAccessTitle")}
              description={t("noCalendarAccessHint")}
            />
          </div>
        )}

      {/* Ошибка загрузки календаря */}
      {calendarApiEnabled && !calendarDataPending && calendarLoadError && (
        <div
          className="mx-4 mt-3 rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-4"
          role="alert"
        >
          <p className="font-medium">{t("loadErrorTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("loadErrorHint")}
          </p>
          <button
            type="button"
            className="mt-2 text-sm font-medium text-primary hover:underline"
            onClick={() => {
              void resourcesQuery.refetch();
              void eventsQuery.refetch();
            }}
          >
            {t("retry")}
          </button>
        </div>
      )}

      {/* Нет ресурсов */}
      {calendarApiEnabled &&
        !calendarLoadError &&
        !calendarDataPending &&
        resources.length === 0 && (
          <div className="px-4 pt-3">
            <BusinessEmptyState
              icon={Calendar}
              title={t("emptyResourcesTitle")}
              description={t("emptyResourcesHint")}
            />
          </div>
        )}

      {/* Сам календарь */}
      {calendarApiEnabled &&
        !calendarLoadError &&
        (calendarDataPending || resources.length > 0) && (
          <CalendarWidget
            resources={resources}
            events={events}
            unavailableRanges={unavailableRanges}
            isLoading={calendarDataPending}
            isFetching={isFetching}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            dayKey={dayKey}
            onDayKeyChange={setDayKey}
            selectedResourceId={selectedResourceId}
            onSelectedResourceIdChange={setSelectedResourceId}
            todayKey={todayKey}
            onEventClick={handleEventClick}
            onCreateBlock={
              canManageActiveWorkplaceCalendar ? handleCreateBlock : undefined
            }
          />
        )}

      {/* Диалог блока / записей */}
      <BusinessCalendarBlockDialog
        state={dialogState}
        resources={resources}
        sdk={sdk}
        onClose={() => setDialogState({ type: "closed" })}
        onSuccess={handleEventsRefresh}
        renderBookingDetail={(event, { onClose }) => (
          <BusinessCalendarBookingDetail
            event={event}
            sdk={sdk}
            accessToken={accessToken}
            salonBookingsQueryEnabled={calendarApiEnabled}
            canConfirmBooking={canConfirmActiveWorkplaceBookings}
            canCancelBooking={canCancelActiveWorkplaceBookings}
            canManageBooking={canManageActiveWorkplaceBookings}
            onClose={onClose}
            onBookingMutateSuccess={handleEventsRefresh}
          />
        )}
      />
    </main>
  );
}
