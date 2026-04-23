"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { BookingsCancelData } from "@/shared/api/generated/sdk/types.gen";
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
import { CLIENT_CANCEL_REASON_CODES } from "../model/client-cancel-reasons";

type CancelBody = BookingsCancelData["body"];

export type BookingCancelDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Возврат из `onConfirm` после успешного ответа API (закрытие диалога — в родителе). */
  onConfirm: (body: CancelBody) => Promise<void>;
};

export function BookingCancelDialog({
  open,
  onOpenChange,
  onConfirm,
}: BookingCancelDialogProps) {
  const t = useTranslations("bookingCancel");
  const [reason, setReason] = useState<CancelBody["cancelReason"]>(
    CLIENT_CANCEL_REASON_CODES[0],
  );
  const [comment, setComment] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    setLocalError(null);
    if (reason === "client_other" && comment.trim() === "") {
      setLocalError(t("validationOther"));
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
      title={t("title")}
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
            {t("dismiss")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="lg"
            disabled={busy}
            aria-busy={busy}
            onClick={() => void handleSubmit()}
          >
            {t("submit")}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <label
            htmlFor="booking-cancel-reason"
            className="text-sm font-medium text-neutral-900 dark:text-neutral-900"
          >
            {t("reasonLabel")}
          </label>
          <Select
            value={reason}
            disabled={busy}
            onValueChange={(v) => {
              setReason(v as CancelBody["cancelReason"]);
              setLocalError(null);
            }}
          >
            <SelectTrigger
              id="booking-cancel-reason"
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
              {CLIENT_CANCEL_REASON_CODES.map((code) => (
                <SelectItem key={code} value={code}>
                  {t(`reasons.${code}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <label
            htmlFor="booking-cancel-comment"
            className="text-sm font-medium text-neutral-900 dark:text-neutral-900"
          >
            {t("commentLabel")}
            {reason === "client_other" ? (
              <span className="font-normal text-neutral-600 dark:text-neutral-600">
                {" "}
                ({t("commentRequiredHint")})
              </span>
            ) : null}
          </label>
          <textarea
            id="booking-cancel-comment"
            rows={3}
            className={cn(
              "resize-y rounded-lg px-3 py-2 text-sm",
              bookingCancelFilledFieldClassName,
              "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ds-ring)]/40",
            )}
            placeholder={t("commentPlaceholder")}
            value={comment}
            disabled={busy}
            onChange={(e) => {
              setComment(e.target.value);
              setLocalError(null);
            }}
          />
        </div>

        {localError ? (
          <p className="text-sm text-destructive" role="alert">
            {localError}
          </p>
        ) : null}
      </div>
    </BookingActionDialog>
  );
}
