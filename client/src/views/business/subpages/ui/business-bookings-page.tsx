"use client";

import { useCallback, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/app/i18n/routing";
import { BusinessEmptyState } from "@/entities/business";
import {
  bookingIsNewTab,
  compareBookingsNewTabPriority,
  enrichSalonBookingRow,
  SalonBookingRowCard,
} from "@/entities/booking";
import { useSetBusinessPageTitle } from "@/widgets/business/chrome";
import {
  canOrganization,
  OrganizationBookingActions,
  OrganizationCapabilities,
  specialistMyOrganizationsQueryKey,
} from "@/entities/organizations";
import {
  createBrowserSdkClient,
  specialistsCabinetGetSpecialistMyOrganizations,
  specialistsCabinetGetSpecialistSalonBookings,
} from "@/shared/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/shadcn/collapsible";
import {
  bookingSlotStartTimeReachedClient,
  useBookingStartWindowPulseWhenWaiting,
} from "@/shared/lib/booking-slot-start-client";
import { cn, motion } from "@/shared/lib";
import { SalonConfirmedCancelDialog } from "./salon-confirmed-cancel-dialog";
import {
  SALON_BOOKINGS_QUERY_KEY_PREFIX,
  SALON_BOOKINGS_SCOPE_ACTIVE_WORKPLACE,
  salonBookingsActiveWorkplaceQueryKey,
} from "../lib/salon-bookings-query";
import { useSalonBookingMutations } from "../lib/use-salon-booking-mutations";

export function BusinessBookingsPage() {
  const t = useTranslations("businessAppSubpages");
  useSetBusinessPageTitle(t("bookingsTitle"));
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

  const onSalonBookingPendingExpired = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: [...SALON_BOOKINGS_QUERY_KEY_PREFIX],
    });
  }, [queryClient]);

  const {
    confirmSalonPendingBooking,
    rejectSalonPendingBookingAfterConfirm,
    startSalonVisit,
    salonCancelConfirmedMutation,
    salonRowActionsBusy,
  } = useSalonBookingMutations({ sdk });

  const [salonCancelTargetId, setSalonCancelTargetId] = useState<string | null>(
    null,
  );

  const openSalonCancelConfirmedDialog = useCallback((bookingId: string) => {
    setSalonCancelTargetId(bookingId);
  }, []);

  const activeWorkplace = useMemo(() => {
    const orgs = orgsQuery.data?.organizations ?? [];
    return orgs.find((o) => o.isActiveWorkplace === true) ?? null;
  }, [orgsQuery.data?.organizations]);

  const hasActiveWorkplace = activeWorkplace != null;
  const canViewActiveWorkplaceBookings = canOrganization(
    activeWorkplace,
    OrganizationCapabilities.BOOKINGS,
    { bookingAction: OrganizationBookingActions.VIEW },
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

  const bookingsQuery = useQuery({
    queryKey: salonBookingsActiveWorkplaceQueryKey(accessToken, locale),
    enabled: authed && orgsQuery.isSuccess && canViewActiveWorkplaceBookings,
    queryFn: async () => {
      const { data: res, error: err } =
        await specialistsCabinetGetSpecialistSalonBookings({
          client: sdk,
          query: { scope: SALON_BOOKINGS_SCOPE_ACTIVE_WORKPLACE, locale },
        });
      if (err || !res) {
        throw err ?? new Error("salon-bookings");
      }
      return res;
    },
  });

  const cards = useMemo(() => {
    const rows = bookingsQuery.data?.bookings ?? [];
    return rows.map((row) =>
      enrichSalonBookingRow(row, {
        format,
        tRoot,
        tBooking,
        tBookingHistory,
        tSalonMasterReasonLabels,
        tSalonSeenClientReasonLabels,
      }),
    );
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
    !hasActiveWorkplace &&
    !bookingsQuery.isPending &&
    !bookingsQuery.isError &&
    cards.length === 0;

  const bookingsIntroShort = t("bookingsIntroShort");

  if (sessionStatus === "loading") {
    return (
      <main className="flex w-full min-h-0 flex-1 flex-col gap-5 px-4 pt-2">
        <div className="h-40 animate-pulse rounded-2xl bg-muted/50" aria-busy />
      </main>
    );
  }

  if (sessionStatus === "unauthenticated" || !accessToken) {
    return (
      <main className="flex w-full min-h-0 flex-1 flex-col gap-5 px-4 pt-2">
        <BusinessEmptyState
          icon={CalendarDays}
          title={t("orgsSignInTitle")}
          description={t("orgsSignInHint")}
        />
      </main>
    );
  }

  return (
    <main className="flex w-full min-h-0 flex-1 flex-col gap-5 px-4 pt-2">
      <p className="text-sm leading-relaxed text-muted-foreground">
        {bookingsIntroShort}
      </p>

      <div>
        {bookingsQuery.isPending || !orgsQuery.isFetched ? (
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
        ) : hasActiveWorkplace && !canViewActiveWorkplaceBookings ? (
          <BusinessEmptyState
            icon={CalendarDays}
            title={t("emptyBookingsNoAccessTitle")}
            description={t("emptyBookingsNoAccessHint")}
          />
        ) : cards.length === 0 ? (
          <BusinessEmptyState
            icon={CalendarDays}
            title={t("emptyBookingsTitleMine")}
            description={t("emptyBookingsHintMine")}
          />
        ) : (
          <div className="space-y-4" aria-label={t("bookingsListAria")}>
            {newSectionCards.length > 0 ? (
              <Collapsible
                defaultOpen
                className="group w-full overflow-hidden p-0"
              >
                <CollapsibleTrigger
                  className={cn(
                    motion.interactivePressStrong,
                    "flex w-full touch-manipulation items-center justify-between gap-2 px-0 py-1 text-left outline-none rounded-lg hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-ring/45",
                  )}
                  id={`salon-bookings-${SALON_BOOKINGS_SCOPE_ACTIVE_WORKPLACE}-new-heading`}
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
                  id={`salon-bookings-${SALON_BOOKINGS_SCOPE_ACTIVE_WORKPLACE}-new-panel`}
                  role="region"
                  aria-labelledby={`salon-bookings-${SALON_BOOKINGS_SCOPE_ACTIVE_WORKPLACE}-new-heading`}
                >
                  <ul className="flex flex-col gap-3 pt-2">
                    {newSectionCards.map((row) => (
                      <li key={row.id}>
                        <SalonBookingRowCard
                          row={row}
                          scope={SALON_BOOKINGS_SCOPE_ACTIVE_WORKPLACE}
                          onPendingExpired={onSalonBookingPendingExpired}
                          onPendingAccept={
                            row.status === "pending" &&
                            canConfirmActiveWorkplaceBookings
                              ? () => confirmSalonPendingBooking(row.id)
                              : undefined
                          }
                          onPendingReject={
                            row.status === "pending" &&
                            canCancelActiveWorkplaceBookings
                              ? () =>
                                  void rejectSalonPendingBookingAfterConfirm(
                                    row.id,
                                  )
                              : undefined
                          }
                          onConfirmedStartVisit={
                            row.status === "confirmed" &&
                            canManageActiveWorkplaceBookings
                              ? () => startSalonVisit(row.id)
                              : undefined
                          }
                          onConfirmedOpenCancel={
                            row.status === "confirmed" &&
                            canCancelActiveWorkplaceBookings
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
              <Collapsible
                defaultOpen={newSectionCards.length === 0}
                className="group w-full overflow-hidden p-0"
              >
                <CollapsibleTrigger
                  className={cn(
                    motion.interactivePressStrong,
                    "flex w-full touch-manipulation items-center justify-between gap-2 px-0 py-1 text-left outline-none rounded-lg hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-ring/45",
                  )}
                  id={`salon-bookings-${SALON_BOOKINGS_SCOPE_ACTIVE_WORKPLACE}-history-heading`}
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
                  id={`salon-bookings-${SALON_BOOKINGS_SCOPE_ACTIVE_WORKPLACE}-history-panel`}
                  role="region"
                  aria-labelledby={`salon-bookings-${SALON_BOOKINGS_SCOPE_ACTIVE_WORKPLACE}-history-heading`}
                >
                  <ul className="flex flex-col gap-3 pt-2">
                    {historySectionCards.map((row) => (
                      <li key={row.id}>
                        <SalonBookingRowCard
                          row={row}
                          scope={SALON_BOOKINGS_SCOPE_ACTIVE_WORKPLACE}
                          onPendingExpired={onSalonBookingPendingExpired}
                          onPendingAccept={
                            row.status === "pending" &&
                            canConfirmActiveWorkplaceBookings
                              ? () => confirmSalonPendingBooking(row.id)
                              : undefined
                          }
                          onPendingReject={
                            row.status === "pending" &&
                            canCancelActiveWorkplaceBookings
                              ? () =>
                                  void rejectSalonPendingBookingAfterConfirm(
                                    row.id,
                                  )
                              : undefined
                          }
                          onConfirmedStartVisit={
                            row.status === "confirmed" &&
                            canManageActiveWorkplaceBookings
                              ? () => startSalonVisit(row.id)
                              : undefined
                          }
                          onConfirmedOpenCancel={
                            row.status === "confirmed" &&
                            canCancelActiveWorkplaceBookings
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
