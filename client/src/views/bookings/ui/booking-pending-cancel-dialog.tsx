"use client";

import { useTranslations } from "next-intl";
import {
  BookingActionDialog,
  bookingActionDialogDismissButtonClassName,
} from "@/entities/booking";
import { cn } from "@/shared/lib";
import { Button } from "@/shared/ui/shadcn/button";

export type BookingPendingCancelDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
};

export function BookingPendingCancelDialog({
  open,
  onOpenChange,
  onConfirm,
  busy = false,
}: BookingPendingCancelDialogProps) {
  const t = useTranslations("bookings");

  return (
    <BookingActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("cancelConfirmTitle")}
      showCloseButton={!busy}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className={cn(bookingActionDialogDismissButtonClassName)}
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {t("cancelConfirmDismissLabel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="lg"
            disabled={busy}
            aria-busy={busy}
            onClick={() => void onConfirm()}
          >
            {t("cancelConfirmActionLabel")}
          </Button>
        </>
      }
    />
  );
}
