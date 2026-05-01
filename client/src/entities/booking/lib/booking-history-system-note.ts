import {
  BOOKING_AUTO_CANCEL_MASTER_LEFT_WORKPLACE_EN,
  BOOKING_CANCEL_REASON_MASTER_LEFT_WORKPLACE_ADDRESS,
  BOOKING_CANCEL_REASON_PENDING_CONFIRMATION_TIMEOUT,
} from "../model/booking-cancel-reasons";
import { isBookingClientCancelDisplayCode } from "../model/booking-client-cancel-display-codes";
import { isBookingMasterCancelDisplayCode } from "../model/booking-master-cancel-display-codes";

/** Совпадение текста комментария с уже показанной строкой причины (разный регистр/знаки). */
function clientHistoryNoteRedundantVersusReasonLine(
  reasonLine: string,
  comment: string,
): boolean {
  const key = (s: string): string =>
    s
      .trim()
      .toLocaleLowerCase("und")
      .replace(/[\s.,!?;:…'"«»""''()-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const a = key(reasonLine);
  const b = key(comment);
  return a.length > 0 && b.length > 0 && a === b;
}

/**
 * Текст под статусом в истории записей (системные коды / коды отмены / комментарий).
 * Салон в ЛК может передать `tMasterCancelReasonLabel` из коротких подписей кабинета.
 */
export function bookingHistorySystemNote(
  status: string,
  cancelReason: string | null | undefined,
  cancellationComment: string | null | undefined,
  tHistory: (
    key: "systemMasterLeftWorkplace" | "systemExpiredNoConfirmation",
  ) => string,
  tMasterCancelReasonLabel: (code: string) => string,
  tClientCancelReasonLabel: (code: string) => string,
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
    let reasonLine: string | undefined;
    if (
      cancelReason === BOOKING_CANCEL_REASON_MASTER_LEFT_WORKPLACE_ADDRESS ||
      cancelReason === BOOKING_AUTO_CANCEL_MASTER_LEFT_WORKPLACE_EN
    ) {
      reasonLine = tHistory("systemMasterLeftWorkplace");
      parts.push(reasonLine);
    } else if (cancelReason?.trim()) {
      const trimmed = cancelReason.trim();
      reasonLine = isBookingMasterCancelDisplayCode(trimmed)
        ? tMasterCancelReasonLabel(trimmed)
        : trimmed;
      parts.push(reasonLine);
    }
    if (
      comment &&
      (reasonLine == null ||
        !clientHistoryNoteRedundantVersusReasonLine(reasonLine, comment))
    ) {
      parts.push(comment);
    }
    return parts.length > 0 ? parts.join("\n\n") : undefined;
  }
  if (status === "canceled_by_client") {
    const parts: string[] = [];
    let reasonLine: string | undefined;
    if (cancelReason?.trim()) {
      const trimmed = cancelReason.trim();
      reasonLine = isBookingClientCancelDisplayCode(trimmed)
        ? tClientCancelReasonLabel(trimmed)
        : trimmed;
      parts.push(reasonLine);
    }
    if (
      comment &&
      (reasonLine == null ||
        !clientHistoryNoteRedundantVersusReasonLine(reasonLine, comment))
    ) {
      parts.push(comment);
    }
    return parts.length > 0 ? parts.join("\n\n") : undefined;
  }
  if (comment) {
    return comment;
  }
  return undefined;
}
