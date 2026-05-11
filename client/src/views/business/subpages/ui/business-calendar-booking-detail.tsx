"use client";

import { useCallback, useMemo, useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/app/i18n/routing";
import {
  type BookingStatus,
  enrichSalonBookingRow,
  SalonBookingRowCard,
} from "@/entities/booking";
import {
  createBrowserSdkClient,
  specialistsCabinetGetSpecialistSalonBookings,
} from "@/shared/api";
import type { CalendarEvent } from "@/widgets/calendar";
import { buildSalonBookingRowFromCalendarEvent } from "../lib/build-salon-booking-row-from-calendar-event";
import {
  SALON_BOOKINGS_QUERY_KEY_PREFIX,
  SALON_BOOKINGS_SCOPE_ACTIVE_WORKPLACE,
  salonBookingsActiveWorkplaceQueryKey,
} from "../lib/salon-bookings-query";
import { useSalonBookingMutations } from "../lib/use-salon-booking-mutations";
import { SalonConfirmedCancelDialog } from "./salon-confirmed-cancel-dialog";
import { Button } from "@/shared/ui/shadcn/button";
import {
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/shadcn/dialog";

type Sdk = ReturnType<typeof createBrowserSdkClient>;

export function BusinessCalendarBookingDetail({
  event,
  sdk,
  accessToken,
  salonBookingsQueryEnabled = true,
  canConfirmBooking,
  canCancelBooking,
  canManageBooking,
  onClose,
  onBookingMutateSuccess,
}: {
  event: CalendarEvent;
  sdk: Sdk;
  accessToken: string;
  /** Выключать запрос салонных броней, если нет активного места приёма (календарь не должен бить API). */
  salonBookingsQueryEnabled?: boolean;
  canConfirmBooking: boolean;
  canCancelBooking: boolean;
  canManageBooking: boolean;
  onClose: () => void;
  onBookingMutateSuccess?: () => void;
}) {
  const queryClient = useQueryClient();
  const locale = useLocale() as AppLocale;
  const format = useFormatter();
  const tRoot = useTranslations();
  const tBooking = useTranslations("booking");
  const tBookingHistory = useTranslations("bookingHistory");
  const tSalonMasterReasonLabels = useTranslations(
    "businessAppSubpages.bookingMasterCancel.reasons",
  );
  const tSalonSeenClientReasonLabels = useTranslations(
    "bookingHistory.clientCancelReasons",
  );
  const tBusinessCalendar = useTranslations("businessCalendarPage");
  const tObStatus = useTranslations("businessOnboarding.status");

  const getStatusLabel = useCallback(
    (status: BookingStatus) => tObStatus(status),
    [tObStatus],
  );

  const bookingsQuery = useQuery({
    queryKey: salonBookingsActiveWorkplaceQueryKey(accessToken, locale),
    enabled: accessToken.length > 0 && salonBookingsQueryEnabled,
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

  const onPendingExpired = useCallback(() => {
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
  } = useSalonBookingMutations({
    sdk,
    onMutationSuccess: onBookingMutateSuccess,
  });

  const [salonCancelTargetId, setSalonCancelTargetId] = useState<string | null>(
    null,
  );

  const openSalonCancelConfirmedDialog = useCallback((bookingId: string) => {
    setSalonCancelTargetId(bookingId);
  }, []);

  const baseRow = useMemo(() => {
    if (event.type !== "booking" || event.booking == null) {
      return null;
    }
    const fromApi = bookingsQuery.data?.bookings?.find(
      (b) => b.id === event.booking?.id,
    );
    return (
      fromApi ?? buildSalonBookingRowFromCalendarEvent(event, getStatusLabel)
    );
  }, [bookingsQuery.data?.bookings, event, getStatusLabel]);

  const enriched = useMemo(() => {
    if (baseRow == null) {
      return null;
    }
    return enrichSalonBookingRow(baseRow, {
      format,
      tRoot,
      tBooking,
      tBookingHistory,
      tSalonMasterReasonLabels,
      tSalonSeenClientReasonLabels,
    });
  }, [
    baseRow,
    format,
    tRoot,
    tBooking,
    tBookingHistory,
    tSalonMasterReasonLabels,
    tSalonSeenClientReasonLabels,
  ]);

  if (event.type !== "booking" || event.booking == null) {
    return null;
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{tBusinessCalendar("bookingDetailTitle")}</DialogTitle>
      </DialogHeader>
      <div className="max-h-[min(70vh,520px)] overflow-y-auto py-1">
        {enriched == null ? (
          <div
            className="h-36 animate-pulse rounded-2xl bg-muted/50"
            aria-busy
          />
        ) : (
          <SalonBookingRowCard
            row={enriched}
            scope={SALON_BOOKINGS_SCOPE_ACTIVE_WORKPLACE}
            onPendingExpired={onPendingExpired}
            onPendingAccept={
              enriched.status === "pending" && canConfirmBooking
                ? () => confirmSalonPendingBooking(enriched.id)
                : undefined
            }
            onPendingReject={
              enriched.status === "pending" && canCancelBooking
                ? () => void rejectSalonPendingBookingAfterConfirm(enriched.id)
                : undefined
            }
            onConfirmedStartVisit={
              enriched.status === "confirmed" && canManageBooking
                ? () => startSalonVisit(enriched.id)
                : undefined
            }
            onConfirmedOpenCancel={
              enriched.status === "confirmed" && canCancelBooking
                ? () => openSalonCancelConfirmedDialog(enriched.id)
                : undefined
            }
            salonActionsBusy={salonRowActionsBusy}
          />
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          {tBusinessCalendar("dialog.close")}
        </Button>
      </DialogFooter>
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
    </>
  );
}
