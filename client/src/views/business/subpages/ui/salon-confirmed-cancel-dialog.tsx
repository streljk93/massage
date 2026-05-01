"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { SpecialistBookingsCancelConfirmedData } from "@/shared/api/generated/sdk/types.gen";
import {
  BookingActionDialog,
  bookingActionDialogDismissButtonClassName,
  bookingCancelFilledFieldClassName,
  bookingCancelSelectContentClassName,
} from "@/entities/booking";
import { cn } from "@/shared/lib";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui";
import { Button } from "@/shared/ui/shadcn/button";
import { Textarea } from "@/shared/ui/shadcn/textarea";
import {
  MASTER_CANCEL_REASON_CODES,
  type MasterCancelReasonCode,
} from "../model/master-cancel-reasons";

type CancelBody = SpecialistBookingsCancelConfirmedData["body"];

export type SalonConfirmedCancelDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (body: CancelBody) => Promise<void>;
};

export function SalonConfirmedCancelDialog({
  open,
  onOpenChange,
  onConfirm,
}: SalonConfirmedCancelDialogProps) {
  const t = useTranslations("businessAppSubpages");
  const [reason, setReason] = useState<MasterCancelReasonCode>(
    MASTER_CANCEL_REASON_CODES[0],
  );
  const [comment, setComment] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    setLocalError(null);
    if (reason === "master_other" && comment.trim() === "") {
      setLocalError(t("bookingMasterCancel.validationOther"));
      return;
    }
    const trimmed = comment.trim();
    const body: CancelBody = {
      cancelReason: reason,
      ...(trimmed !== "" ? { cancellationComment: trimmed } : {}),
    };
    setBusy(true);
    try {
      await onConfirm(body);
    } finally {
      setBusy(false);
    }
  };

  return (
    <BookingActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("bookingMasterCancel.title")}
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
            {t("bookingMasterCancel.dismiss")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="lg"
            disabled={busy}
            aria-busy={busy}
            onClick={() => void handleSubmit()}
          >
            {t("bookingMasterCancel.submit")}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <label
            htmlFor="salon-booking-cancel-reason"
            className="text-sm font-medium text-neutral-900 dark:text-neutral-900"
          >
            {t("bookingMasterCancel.reasonLabel")}
          </label>
          <Select
            value={reason}
            disabled={busy}
            onValueChange={(v) => {
              setReason(v as MasterCancelReasonCode);
              setLocalError(null);
            }}
          >
            <SelectTrigger
              id="salon-booking-cancel-reason"
              className={cn(
                "w-full min-w-0",
                bookingCancelFilledFieldClassName,
                "hover:bg-stone-200/40 dark:hover:bg-stone-200/40",
              )}
              size="default"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              position="popper"
              align="start"
              className={bookingCancelSelectContentClassName}
            >
              {MASTER_CANCEL_REASON_CODES.map((code) => (
                <SelectItem key={code} value={code}>
                  {t(`bookingMasterCancel.reasons.${code}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <label
            htmlFor="salon-booking-cancel-comment"
            className="text-sm font-medium text-neutral-900 dark:text-neutral-900"
          >
            {t("bookingMasterCancel.commentLabel")}
          </label>
          <Textarea
            id="salon-booking-cancel-comment"
            rows={3}
            disabled={busy}
            placeholder={t("bookingMasterCancel.commentPlaceholder")}
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              setLocalError(null);
            }}
            className={cn(bookingCancelFilledFieldClassName, "min-h-[5.5rem] resize-y")}
          />
          {localError != null ?
            <p className="text-sm text-destructive" role="alert">
              {localError}
            </p>
          : null}
        </div>
      </div>
    </BookingActionDialog>
  );
}
