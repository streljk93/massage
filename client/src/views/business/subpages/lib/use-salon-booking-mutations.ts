"use client";

import { useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  specialistBookingsCancelConfirmed,
  specialistBookingsConfirmPending,
  specialistBookingsRejectPending,
  specialistBookingsStartVisit,
  type createBrowserSdkClient,
} from "@/shared/api";
import type { SpecialistBookingsCancelConfirmedData } from "@/shared/api/generated/sdk/types.gen";
import { confirmAction, notify } from "@/shared/lib/notifications";
import { SALON_BOOKINGS_QUERY_KEY_PREFIX } from "./salon-bookings-query";

type Sdk = ReturnType<typeof createBrowserSdkClient>;

type SpecialistCancelConfirmedBody =
  SpecialistBookingsCancelConfirmedData["body"];

export function useSalonBookingMutations({
  sdk,
  onMutationSuccess,
}: {
  sdk: Sdk;
  /** Доп. инвалидации после успешной операции (например список событий календаря). */
  onMutationSuccess?: () => void;
}) {
  const queryClient = useQueryClient();
  const t = useTranslations("businessAppSubpages");
  const onExtraSuccessRef = useRef(onMutationSuccess);
  onExtraSuccessRef.current = onMutationSuccess;

  const invalidateSalonBookings = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [...SALON_BOOKINGS_QUERY_KEY_PREFIX] });
    onExtraSuccessRef.current?.();
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
      invalidateSalonBookings();
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
      invalidateSalonBookings();
      notify.success(t("bookingsStartVisitSuccess"));
    },
    onError: () => {
      notify.error(t("bookingsStartVisitError"));
    },
  });

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
      invalidateSalonBookings();
      notify.success(t("bookingsCancelConfirmedSuccess"));
    },
    onError: () => {
      notify.error(t("bookingsCancelConfirmedError"));
    },
  });

  const startSalonVisit = useCallback(
    (bookingId: string) => {
      salonStartVisitMutation.mutate(bookingId);
    },
    [salonStartVisitMutation],
  );

  const salonRowActionsBusy =
    salonBookingDecisionBusy ||
    salonStartVisitMutation.isPending ||
    salonCancelConfirmedMutation.isPending;

  return {
    confirmSalonPendingBooking,
    rejectSalonPendingBookingAfterConfirm,
    startSalonVisit,
    salonCancelConfirmedMutation,
    salonRowActionsBusy,
  };
}
