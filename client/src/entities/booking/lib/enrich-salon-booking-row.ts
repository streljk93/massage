import { parseISO } from "date-fns";
import type { useFormatter, useTranslations } from "next-intl";
import type { SpecialistsCabinetGetSpecialistSalonBookingsResponse } from "@/shared/api/generated/sdk/types.gen";
import { vnCalendarYmdString, vnTomorrowFromNow } from "@/shared/lib/datetime/vn-listing-datetime";
import { bookingHistorySystemNote } from "./booking-history-system-note";
import { bookingIsNewTab } from "./booking-tab-group";
import { formatBookingServiceLineClient } from "./format-service-line-client";

export type SalonBookingRow =
  SpecialistsCabinetGetSpecialistSalonBookingsResponse["bookings"][number];

export type EnrichedSalonBookingRow = SalonBookingRow & {
  dateLabel: string;
  timeRange: string;
  serviceLine: string;
  /** Пояснение к статусу (причина отмены / истечения); только для вкладки «история» и смежных случаев. */
  cancelNote?: string | undefined;
};

type ClientT = ReturnType<typeof useTranslations>;
type ClientFormat = ReturnType<typeof useFormatter>;

export function enrichSalonBookingRow(
  row: SalonBookingRow,
  deps: {
    format: ClientFormat;
    tRoot: ClientT;
    tBooking: (key: string) => string;
    tBookingHistory: (key: string) => string;
    tSalonMasterReasonLabels: (code: string) => string;
    tSalonSeenClientReasonLabels: (code: string) => string;
    /** По умолчанию «сейчас» на клиенте (удобно для тестов). */
    now?: Date;
  },
): EnrichedSalonBookingRow {
  const now = deps.now ?? new Date();
  const todayYmd = vnCalendarYmdString(now);
  const tomorrowYmd = vnCalendarYmdString(vnTomorrowFromNow(now));

  const start = parseISO(row.startsAt);
  const end = parseISO(row.endsAt);
  const startYmd = vnCalendarYmdString(start);
  let dateLabel: string;
  if (startYmd === todayYmd) {
    dateLabel = deps.tBooking("today");
  } else if (startYmd === tomorrowYmd) {
    dateLabel = deps.tBooking("tomorrow");
  } else {
    dateLabel = deps.format.dateTime(start, { dateStyle: "medium" });
  }

  const timeRange = `${deps.format.dateTime(start, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  })} – ${deps.format.dateTime(end, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  })}`;

  const serviceLine =
    row.amount != null ?
      formatBookingServiceLineClient(deps.tRoot, deps.format, {
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
        (key) => deps.tBookingHistory(key),
        (code) => deps.tSalonMasterReasonLabels(code),
        (code) => deps.tSalonSeenClientReasonLabels(code),
      )
    );

  return {
    ...row,
    dateLabel,
    timeRange,
    serviceLine,
    cancelNote,
  };
}
