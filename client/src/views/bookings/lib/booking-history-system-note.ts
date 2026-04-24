import {
  BOOKING_AUTO_CANCEL_MASTER_LEFT_WORKPLACE_EN,
  BOOKING_CANCEL_REASON_MASTER_LEFT_WORKPLACE_ADDRESS,
  BOOKING_CANCEL_REASON_PENDING_CONFIRMATION_TIMEOUT,
} from "@/entities/booking";

/**
 * Текст под статусом в истории записей (системные коды / канонический EN из БД + комментарий мастера).
 */
export function bookingHistorySystemNote(
  status: string,
  cancelReason: string | null | undefined,
  cancellationComment: string | null | undefined,
  tHistory: (
    key: "systemMasterLeftWorkplace" | "systemExpiredNoConfirmation",
  ) => string,
): string | undefined {
  const comment = cancellationComment?.trim();
  if (status === "expired") {
    if (cancelReason === BOOKING_CANCEL_REASON_PENDING_CONFIRMATION_TIMEOUT) {
      return tHistory("systemExpiredNoConfirmation");
    }
    return cancelReason?.trim() || undefined;
  }
  if (status === "canceled_by_master") {
    const parts: string[] = [];
    if (
      cancelReason === BOOKING_CANCEL_REASON_MASTER_LEFT_WORKPLACE_ADDRESS ||
      cancelReason === BOOKING_AUTO_CANCEL_MASTER_LEFT_WORKPLACE_EN
    ) {
      parts.push(tHistory("systemMasterLeftWorkplace"));
    } else if (cancelReason?.trim()) {
      parts.push(cancelReason.trim());
    }
    if (comment) {
      parts.push(comment);
    }
    return parts.length > 0 ? parts.join("\n\n") : undefined;
  }
  if (comment) {
    return comment;
  }
  return undefined;
}
