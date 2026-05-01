"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { parseISO } from "date-fns";
import type { AppLocale } from "@/app/i18n/routing";
import {
  BookingShowcaseCard,
  BOOKING_ACTION_OUTLINE_BUTTON_CLASS,
  bookingHistoryDateTagsMuted,
  bookingHistorySystemNote,
  formatBookingServiceLineClient,
  usePendingBookingCountdown,
} from "@/entities/booking";
import { BusinessEmptyState } from "@/entities/business";
import { specialistMyOrganizationsQueryKey } from "@/entities/organizations";
import {
  bookingIsNewTab,
  compareBookingsNewTabPriority,
} from "@/views/bookings/lib/booking-api-to-ui";
import {
  vnCalendarYmdString,
  vnTomorrowFromNow,
} from "@/views/specialist-profile/lib/booking-starts-at";
import {
  createBrowserSdkClient,
  specialistBookingsCancelConfirmed,
  specialistBookingsConfirmPending,
  specialistBookingsRejectPending,
  specialistBookingsStartVisit,
  specialistsCabinetGetSpecialistMyOrganizations,
  specialistsCabinetGetSpecialistSalonBookings,
} from "@/shared/api";
import type {
  SpecialistsCabinetGetSpecialistSalonBookingsResponse,
  SpecialistBookingsCancelConfirmedData,
} from "@/shared/api/generated/sdk/types.gen";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BusinessScreenHeader } from "@/widgets/business/chrome";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/shadcn/collapsible";
import { Button } from "@/shared/ui/button";
import { bookingSlotStartTimeReachedClient, useBookingStartWindowPulseWhenWaiting } from "@/shared/lib/booking-slot-start-client";
import { cn, motion, resolveApiResourceUrl } from "@/shared/lib";
import { confirmAction, notify } from "@/shared/lib/notifications";
import { SalonConfirmedCancelDialog } from "./salon-confirmed-cancel-dialog";

type SalonBookingRow = SpecialistsCabinetGetSpecialistSalonBookingsResponse["bookings"][number];

const SALON_BOOKINGS_QK = ["specialistSalonBookings"] as const;

function isOrgManagerRole(role: string): boolean {
  return role === "owner" || role === "admin";
}

type BookingsTab = "managed" | "active_workplace";

type EnrichedSalonBookingRow = SalonBookingRow & {
  dateLabel: string;
  timeRange: string;
  serviceLine: string;
  /** Пояснение к статусу (причина отмены / истечения); только для вкладки «история» и смежных случаев. */
  cancelNote?: string | undefined;
};

function SalonBookingRowCard({
  row,
  scope,
  onPendingExpired,
  onPendingAccept,
  onPendingReject,
  onConfirmedStartVisit,
  onConfirmedOpenCancel,
  salonActionsBusy,
}: {
  row: EnrichedSalonBookingRow;
  scope: "managed" | "active_workplace";
  onPendingExpired?: () => void;
  onPendingAccept?: () => void;
  onPendingReject?: () => void;
  onConfirmedStartVisit?: () => void;
  onConfirmedOpenCancel?: () => void;
  salonActionsBusy?: boolean;
}) {
  const t = useTranslations("businessAppSubpages");
  const tList = useTranslations("bookingList");

  const countdown = usePendingBookingCountdown(
    row.pendingExpiresAt,
    row.status === "pending",
    onPendingExpired,
  );

  const visitWindowReady =
    row.status === "confirmed" ?
      bookingSlotStartTimeReachedClient(row.startsAt)
    : false;

  const guestParts: string[] = [t("bookingsClientCaption", { name: row.clientDisplayName })];
  if (scope === "managed" && row.organizationName != null && row.organizationName !== "") {
    guestParts.push(t("bookingsSalonCaption", { name: row.organizationName }));
  }
  const guestCaption = guestParts.join(" · ");

  const resolvedStatusLabel =
    row.statusLabel.trim() !== "" ? row.statusLabel.trim() : "\u2014";

  const secondaryNoteRaw = row.cancelNote?.trim();
  const secondaryNote =
    secondaryNoteRaw != null && secondaryNoteRaw !== "" ?
      secondaryNoteRaw
    : undefined;

  const statusFooter =
    row.status === "pending" && countdown != null ?
      <div className="flex w-full min-w-0 items-baseline justify-between gap-3">
        <p className="min-w-0 flex-1 font-medium leading-snug text-foreground">
          {resolvedStatusLabel}
        </p>
        <p
          className="shrink-0 tabular-nums text-muted-foreground"
          aria-label={tList("statusPendingTimer", {
            minutes: countdown.minutes,
            seconds: countdown.seconds,
          })}
        >
          {tList("statusPendingTimeCompact", {
            minutes: countdown.minutes,
            seconds: countdown.seconds,
          })}
        </p>
      </div>
    : secondaryNote != null ?
      <div className="space-y-1.5">
        <p className="font-medium text-foreground">{resolvedStatusLabel}</p>
        <p
          role="note"
          className="text-pretty whitespace-pre-wrap text-xs leading-snug text-muted-foreground break-words"
        >
          {secondaryNote}
        </p>
      </div>
    : (
      <p className="font-medium text-foreground">{resolvedStatusLabel}</p>
      );

  const pendingActions =
    row.status === "pending" && onPendingAccept != null && onPendingReject != null ?
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="ghost"
          className={cn(BOOKING_ACTION_OUTLINE_BUTTON_CLASS, "text-primary hover:text-primary")}
          onClick={onPendingAccept}
          disabled={salonActionsBusy}
          aria-busy={salonActionsBusy}
        >
          {t("incomingAccept")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            BOOKING_ACTION_OUTLINE_BUTTON_CLASS,
            "border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive",
          )}
          onClick={onPendingReject}
          disabled={salonActionsBusy}
          aria-busy={salonActionsBusy}
        >
          {t("incomingReject")}
        </Button>
      </div>
    : null;

  const confirmedActions =
    row.status === "confirmed" &&
    onConfirmedStartVisit != null &&
    onConfirmedOpenCancel != null ?
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="ghost"
          className={cn(BOOKING_ACTION_OUTLINE_BUTTON_CLASS, "text-primary hover:text-primary")}
          onClick={() => {
            if (!visitWindowReady) {
              notify.info(
                t("bookingsStartVisitTooEarlyToast"),
                t("bookingsStartVisitTooEarlyToastDescription"),
              );
              return;
            }
            onConfirmedStartVisit();
          }}
          disabled={salonActionsBusy}
          aria-busy={salonActionsBusy}
          aria-label={t("bookingsConfirmedStartVisit")}
        >
          {t("bookingsConfirmedStartVisit")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            BOOKING_ACTION_OUTLINE_BUTTON_CLASS,
            "border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive",
          )}
          onClick={onConfirmedOpenCancel}
          disabled={salonActionsBusy}
          aria-busy={salonActionsBusy}
          aria-label={t("bookingsConfirmedCancel")}
        >
          {t("bookingsConfirmedCancel")}
        </Button>
      </div>
    : null;

  return (
    <BookingShowcaseCard
      variant="light"
      specialistName={row.specialistName}
      serviceLine={row.serviceLine}
      dateLabel={row.dateLabel}
      timeRange={row.timeRange}
      avatarSrc={specialistAvatarSrc(row.specialistImageUrl)}
      specialistProfileHref={`/specialists/${row.specialistId}`}
      specialistLinkAriaLabel={tList("openSpecialistProfile", {
        name: row.specialistName,
      })}
      guestCaption={guestCaption}
      statusFooter={statusFooter}
      statusFooterSuccess={row.status === "confirmed"}
      statusFooterInProgress={row.status === "in_progress"}
      dateTagsMuted={bookingHistoryDateTagsMuted(row.status)}
      actions={pendingActions ?? confirmedActions}
    />
  );
}

function specialistAvatarSrc(url: string | null | undefined): string | undefined {
  if (url == null || url === "") {
    return undefined;
  }
  return url.startsWith("http://") || url.startsWith("https://")
    ? url
    : resolveApiResourceUrl(url);
}

export function BusinessBookingsPage() {
  const t = useTranslations("businessAppSubpages");
  const tBookingsUi = useTranslations("bookings");
  const tBooking = useTranslations("booking");
  const tRoot = useTranslations();
  const tBookingHistory = useTranslations("bookingHistory");
  const tSalonMasterReasonLabels = useTranslations(
    "businessAppSubpages.bookingMasterCancel.reasons",
  );
  const tSalonSeenClientReasonLabels = useTranslations(
    "bookingHistory.clientCancelReasons",
  );
  const format = useFormatter();
  const locale = useLocale() as AppLocale;
  const queryClient = useQueryClient();
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken ?? "";
  const authed = sessionStatus === "authenticated" && accessToken.length > 0;

  const sdk = useMemo(
    () => createBrowserSdkClient(accessToken, { locale }),
    [accessToken, locale],
  );

  const orgsQuery = useQuery({
    queryKey: specialistMyOrganizationsQueryKey(accessToken, locale),
    enabled: authed,
    queryFn: async () => {
      const { data: res, error: err } = await specialistsCabinetGetSpecialistMyOrganizations({
        client: sdk,
      });
      if (err || !res) {
        throw err ?? new Error("organizations");
      }
      return res;
    },
  });

  const canSeeManagedTab = useMemo(
    () => (orgsQuery.data?.organizations ?? []).some((o) => isOrgManagerRole(o.role)),
    [orgsQuery.data?.organizations],
  );

  const [tab, setTab] = useState<BookingsTab>("active_workplace");
  const adminDefaultTabApplied = useRef(false);

  useEffect(() => {
    adminDefaultTabApplied.current = false;
    setTab("active_workplace");
  }, [accessToken]);

  useEffect(() => {
    if (!canSeeManagedTab || adminDefaultTabApplied.current) {
      return;
    }
    adminDefaultTabApplied.current = true;
    setTab("managed");
  }, [canSeeManagedTab]);

  const effectiveScope: "managed" | "active_workplace" = canSeeManagedTab ? tab : "active_workplace";

  const bookingsQuery = useQuery({
    queryKey: [...SALON_BOOKINGS_QK, effectiveScope, accessToken, locale],
    enabled: authed,
    queryFn: async () => {
      const { data: res, error: err } = await specialistsCabinetGetSpecialistSalonBookings({
        client: sdk,
        query: { scope: effectiveScope, locale },
      });
      if (err || !res) {
        throw err ?? new Error("salon-bookings");
      }
      return res;
    },
  });

  const onSalonBookingPendingExpired = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [...SALON_BOOKINGS_QK] });
  }, [queryClient]);

  const salonBookingDecisionMutation = useMutation({
    meta: { skipGlobalErrorNotification: true },
    mutationFn: async (vars: { id: string; kind: "confirm" | "reject" }) => {
      if (vars.kind === "confirm") {
        const { data, error } = await specialistBookingsConfirmPending({
          client: sdk,
          path: { id: vars.id },
        });
        if (error != null) {
          throw error;
        }
        return data;
      }
      const { data, error } = await specialistBookingsRejectPending({
        client: sdk,
        path: { id: vars.id },
      });
      if (error != null) {
        throw error;
      }
      return data;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: [...SALON_BOOKINGS_QK] });
      notify.success(
        vars.kind === "confirm"
          ? t("bookingsPendingAcceptSuccess")
          : t("bookingsPendingRejectSuccess"),
      );
    },
    onError: () => {
      notify.error(t("bookingsPendingActionError"));
    },
  });

  const confirmSalonPendingBooking = useCallback(
    (id: string) => {
      salonBookingDecisionMutation.mutate({ id, kind: "confirm" });
    },
    [salonBookingDecisionMutation],
  );

  const rejectSalonPendingBookingAfterConfirm = useCallback(
    async (id: string) => {
      const ok = await confirmAction({
        title: t("bookingsPendingRejectConfirmTitle"),
        description: t("bookingsPendingRejectConfirmDescription"),
        confirmLabel: t("incomingReject"),
        cancelLabel: t("bookingsPendingRejectCancel"),
        destructive: true,
      });
      if (!ok) {
        return;
      }
      salonBookingDecisionMutation.mutate({ id, kind: "reject" });
    },
    [salonBookingDecisionMutation, t],
  );

  const salonBookingDecisionBusy = salonBookingDecisionMutation.isPending;

  const salonStartVisitMutation = useMutation({
    meta: { skipGlobalErrorNotification: true },
    mutationFn: async (bookingId: string) => {
      const { data, error } = await specialistBookingsStartVisit({
        client: sdk,
        path: { id: bookingId },
      });
      if (error != null) {
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...SALON_BOOKINGS_QK] });
      notify.success(t("bookingsStartVisitSuccess"));
    },
    onError: () => {
      notify.error(t("bookingsStartVisitError"));
    },
  });

  type SpecialistCancelConfirmedBody =
    SpecialistBookingsCancelConfirmedData["body"];

  const salonCancelConfirmedMutation = useMutation({
    meta: { skipGlobalErrorNotification: true },
    mutationFn: async (vars: {
      id: string;
      body: SpecialistCancelConfirmedBody;
    }) => {
      const { data, error } = await specialistBookingsCancelConfirmed({
        client: sdk,
        path: { id: vars.id },
        body: vars.body,
      });
      if (error != null) {
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...SALON_BOOKINGS_QK] });
      notify.success(t("bookingsCancelConfirmedSuccess"));
    },
    onError: () => {
      notify.error(t("bookingsCancelConfirmedError"));
    },
  });

  const [salonCancelTargetId, setSalonCancelTargetId] = useState<string | null>(null);

  const startSalonVisit = useCallback(
    (bookingId: string) => {
      salonStartVisitMutation.mutate(bookingId);
    },
    [salonStartVisitMutation],
  );

  const openSalonCancelConfirmedDialog = useCallback((bookingId: string) => {
    setSalonCancelTargetId(bookingId);
  }, []);

  const salonRowActionsBusy =
    salonBookingDecisionBusy ||
    salonStartVisitMutation.isPending ||
    salonCancelConfirmedMutation.isPending;

  const hasActiveWorkplace = useMemo(() => {
    const orgs = orgsQuery.data?.organizations ?? [];
    return orgs.some((o) => o.isActiveWorkplace === true);
  }, [orgsQuery.data?.organizations]);

  const cards = useMemo(() => {
    const rows = bookingsQuery.data?.bookings ?? [];
    const now = new Date();
    const todayYmd = vnCalendarYmdString(now);
    const tomorrowYmd = vnCalendarYmdString(vnTomorrowFromNow(now));

    return rows.map((row): EnrichedSalonBookingRow => {
      const start = parseISO(row.startsAt);
      const end = parseISO(row.endsAt);
      const startYmd = vnCalendarYmdString(start);
      let dateLabel: string;
      if (startYmd === todayYmd) {
        dateLabel = tBooking("today");
      } else if (startYmd === tomorrowYmd) {
        dateLabel = tBooking("tomorrow");
      } else {
        dateLabel = format.dateTime(start, { dateStyle: "medium" });
      }

      const timeRange = `${format.dateTime(start, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Ho_Chi_Minh",
      })} – ${format.dateTime(end, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Ho_Chi_Minh",
      })}`;

      const serviceLine =
        row.amount != null
          ? formatBookingServiceLineClient(tRoot, format, {
              serviceLabel: row.categoryShortName,
              amount: row.amount,
              currency: row.currency,
            })
          : row.categoryShortName;

      const cancelNote =
        bookingIsNewTab(row.status) ? undefined : (
          bookingHistorySystemNote(
            row.status,
            row.cancelReason,
            row.cancellationComment,
            (key) => tBookingHistory(key),
            (code) => tSalonMasterReasonLabels(code),
            (code) => tSalonSeenClientReasonLabels(code),
          )
        );

      return {
        ...row,
        dateLabel,
        timeRange,
        serviceLine,
        cancelNote,
      };
    });
  }, [
    bookingsQuery.data?.bookings,
    format,
    tBooking,
    tBookingHistory,
    tRoot,
    tSalonMasterReasonLabels,
    tSalonSeenClientReasonLabels,
  ]);

  const { newSectionCards, historySectionCards } = useMemo(() => {
    const next = cards.filter((c) => bookingIsNewTab(c.status));
    next.sort(compareBookingsNewTabPriority);
    const hist = cards.filter((c) => !bookingIsNewTab(c.status));
    hist.sort((a, b) => b.startsAt.localeCompare(a.startsAt));
    return { newSectionCards: next, historySectionCards: hist };
  }, [cards]);

  const hasConfirmedWaitingStartWindow = useMemo(
    () =>
      cards.some(
        (c) =>
          c.status === "confirmed" &&
          !bookingSlotStartTimeReachedClient(c.startsAt),
      ),
    [cards],
  );

  useBookingStartWindowPulseWhenWaiting(hasConfirmedWaitingStartWindow);

  const workplaceEmptyHintEligible =
    orgsQuery.isFetched &&
    effectiveScope === "active_workplace" &&
    !hasActiveWorkplace &&
    !bookingsQuery.isPending &&
    !bookingsQuery.isError &&
    cards.length === 0;

  const intro =
    effectiveScope === "managed" ? t("bookingsIntroManaged") : t("bookingsIntroMine");

  if (sessionStatus === "loading") {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
        <BusinessScreenHeader
          title={t("bookingsTitle")}
          titleVariant="section"
          showHeadline={false}
          avatarAlt={t("bookingsTitle")}
          avatarFallback="B"
        />
        <div className="h-40 animate-pulse rounded-2xl bg-muted/50" aria-busy />
      </main>
    );
  }

  if (sessionStatus === "unauthenticated" || !accessToken) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
        <BusinessScreenHeader
          title={t("bookingsTitle")}
          titleVariant="section"
          showHeadline={false}
          avatarAlt={t("bookingsTitle")}
          avatarFallback="B"
        />
        <BusinessEmptyState
          icon={CalendarDays}
          title={t("orgsSignInTitle")}
          description={t("orgsSignInHint")}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
      <BusinessScreenHeader
        title={t("bookingsTitle")}
        titleVariant="section"
        showHeadline={false}
        avatarAlt={t("bookingsTitle")}
        avatarFallback="B"
      />

      {canSeeManagedTab ? (
        <div
          className="flex rounded-full bg-muted p-1"
          role="tablist"
          aria-label={t("bookingsTablistAria")}
        >
          {(
            [
              { id: "managed" as const, labelKey: "bookingsTabAll" as const },
              { id: "active_workplace" as const, labelKey: "bookingsTabMine" as const },
            ] as const
          ).map(({ id, labelKey }) => {
            const selected = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={cn(
                  motion.interactivePressStrong,
                  "min-w-0 flex-1 rounded-full py-2.5 text-center text-sm font-medium transition-colors",
                  selected ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setTab(id)}
              >
                {t(labelKey)}
              </button>
            );
          })}
        </div>
      ) : null}

      <p className="text-pretty text-[0.9375rem] leading-relaxed text-foreground/85">{intro}</p>

      <div role="tabpanel">
        {(bookingsQuery.isPending || (effectiveScope === "active_workplace" && !orgsQuery.isFetched)) ? (
          <div
            className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"
            aria-busy
            aria-label={t("bookingsLoadingAria")}
          >
            <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden />
          </div>
        ) : bookingsQuery.isError ? (
          <div
            className="rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-foreground"
            role="alert"
          >
            <p className="font-medium">{t("bookingsLoadError")}</p>
            <button
              type="button"
              className={cn(
                motion.interactive,
                "mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline",
              )}
              onClick={() => void bookingsQuery.refetch()}
            >
              {t("bookingsRetry")}
            </button>
          </div>
        ) : workplaceEmptyHintEligible ? (
          <BusinessEmptyState
            icon={CalendarDays}
            title={t("emptyBookingsMineNoWorkplaceTitle")}
            description={t("emptyBookingsMineNoWorkplaceHint")}
          />
        ) : cards.length === 0 ? (
          <BusinessEmptyState
            icon={CalendarDays}
            title={effectiveScope === "managed" ? t("emptyBookingsTitleAll") : t("emptyBookingsTitleMine")}
            description={effectiveScope === "managed" ? t("emptyBookingsHintAll") : t("emptyBookingsHintMine")}
          />
        ) : (
          <div key={effectiveScope} className="space-y-4" aria-label={t("bookingsListAria")}>
            {newSectionCards.length > 0 ? (
              <Collapsible defaultOpen className="group w-full overflow-hidden rounded-2xl bg-muted/45 p-3">
                <CollapsibleTrigger
                  className={cn(
                    motion.interactivePressStrong,
                    "flex w-full touch-manipulation items-center justify-between gap-2 px-1 py-1 text-left outline-none rounded-xl hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/45",
                  )}
                  id={`salon-bookings-${effectiveScope}-new-heading`}
                >
                  <h2 className="font-heading text-sm font-semibold tracking-tight text-foreground">
                    {tBookingsUi("tabNew")}
                    <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">
                      ({newSectionCards.length})
                    </span>
                  </h2>
                  <ChevronDown
                    className="size-5 shrink-0 rotate-0 text-muted-foreground transition-transform duration-300 ease-out group-data-[state=open]:rotate-180"
                    aria-hidden
                  />
                </CollapsibleTrigger>
                <CollapsibleContent
                  id={`salon-bookings-${effectiveScope}-new-panel`}
                  role="region"
                  aria-labelledby={`salon-bookings-${effectiveScope}-new-heading`}
                >
                  <ul className="flex flex-col gap-3 pt-2">
                    {newSectionCards.map((row) => (
                      <li key={row.id}>
                        <SalonBookingRowCard
                          row={row}
                          scope={effectiveScope}
                          onPendingExpired={onSalonBookingPendingExpired}
                          onPendingAccept={
                            row.status === "pending"
                              ? () => confirmSalonPendingBooking(row.id)
                              : undefined
                          }
                          onPendingReject={
                            row.status === "pending"
                              ? () => void rejectSalonPendingBookingAfterConfirm(row.id)
                              : undefined
                          }
                          onConfirmedStartVisit={
                            row.status === "confirmed"
                              ? () => startSalonVisit(row.id)
                              : undefined
                          }
                          onConfirmedOpenCancel={
                            row.status === "confirmed"
                              ? () => openSalonCancelConfirmedDialog(row.id)
                              : undefined
                          }
                          salonActionsBusy={salonRowActionsBusy}
                        />
                      </li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            ) : null}

            {historySectionCards.length > 0 ? (
              <Collapsible defaultOpen={newSectionCards.length === 0} className="group w-full overflow-hidden rounded-2xl bg-muted/45 p-3">
                <CollapsibleTrigger
                  className={cn(
                    motion.interactivePressStrong,
                    "flex w-full touch-manipulation items-center justify-between gap-2 px-1 py-1 text-left outline-none rounded-xl hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/45",
                  )}
                  id={`salon-bookings-${effectiveScope}-history-heading`}
                >
                  <h2 className="font-heading text-sm font-semibold tracking-tight text-foreground">
                    {tBookingsUi("tabHistory")}
                    <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">
                      ({historySectionCards.length})
                    </span>
                  </h2>
                  <ChevronDown
                    className="size-5 shrink-0 rotate-0 text-muted-foreground transition-transform duration-300 ease-out group-data-[state=open]:rotate-180"
                    aria-hidden
                  />
                </CollapsibleTrigger>
                <CollapsibleContent
                  id={`salon-bookings-${effectiveScope}-history-panel`}
                  role="region"
                  aria-labelledby={`salon-bookings-${effectiveScope}-history-heading`}
                >
                  <ul className="flex flex-col gap-3 pt-2">
                    {historySectionCards.map((row) => (
                      <li key={row.id}>
                        <SalonBookingRowCard
                          row={row}
                          scope={effectiveScope}
                          onPendingExpired={onSalonBookingPendingExpired}
                          onPendingAccept={
                            row.status === "pending"
                              ? () => confirmSalonPendingBooking(row.id)
                              : undefined
                          }
                          onPendingReject={
                            row.status === "pending"
                              ? () => void rejectSalonPendingBookingAfterConfirm(row.id)
                              : undefined
                          }
                          onConfirmedStartVisit={
                            row.status === "confirmed"
                              ? () => startSalonVisit(row.id)
                              : undefined
                          }
                          onConfirmedOpenCancel={
                            row.status === "confirmed"
                              ? () => openSalonCancelConfirmedDialog(row.id)
                              : undefined
                          }
                          salonActionsBusy={salonRowActionsBusy}
                        />
                      </li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            ) : null}
          </div>
        )}
      </div>
      <SalonConfirmedCancelDialog
        open={salonCancelTargetId !== null}
        onOpenChange={(open) => {
          if (!open && !salonCancelConfirmedMutation.isPending) {
            setSalonCancelTargetId(null);
          }
        }}
        onConfirm={async (body) => {
          const id = salonCancelTargetId;
          if (id == null) {
            return;
          }
          await salonCancelConfirmedMutation.mutateAsync({ id, body });
          setSalonCancelTargetId(null);
        }}
      />
    </main>
  );
}
