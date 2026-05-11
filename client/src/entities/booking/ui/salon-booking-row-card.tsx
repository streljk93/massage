"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/app/i18n/navigation";
import { bookingHistoryDateTagsMuted } from "../model/booking-status";
import { BOOKING_ACTION_OUTLINE_BUTTON_CLASS } from "./booking-list-card";
import { BookingDoneVisitReviewSummary } from "./booking-done-visit-review-summary";
import { usePendingBookingCountdown } from "../lib/use-pending-booking-countdown";
import { UserAvatar } from "@/shared/ui/avatar";
import { bookingSlotStartTimeReachedClient } from "@/shared/lib/booking-slot-start-client";
import { cn, motion, resolveApiResourceUrl } from "@/shared/lib";
import { notify } from "@/shared/lib/notifications";
import { Button } from "@/shared/ui/button";
import type { EnrichedSalonBookingRow } from "../lib/enrich-salon-booking-row";

export function specialistSalonBookingAvatarSrc(
  url: string | null | undefined,
): string | undefined {
  if (url == null || url === "") {
    return undefined;
  }
  return url.startsWith("http://") || url.startsWith("https://")
    ? url
    : resolveApiResourceUrl(url);
}

export function SalonBookingRowCard({
  row,
  scope: _scope,
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

  const resolvedStatusLabel =
    row.statusLabel.trim() !== "" ? row.statusLabel.trim() : "\u2014";

  const secondaryNoteRaw = row.cancelNote?.trim();
  const secondaryNote =
    secondaryNoteRaw != null && secondaryNoteRaw !== "" ?
      secondaryNoteRaw
    : undefined;

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

  const doneVisitReviewFooter =
    row.status === "done" &&
    (row.visitReviewOrganizationRating != null ||
      row.visitReviewSpecialistRating != null ||
      (row.visitReviewOrganizationExcerpt != null &&
        row.visitReviewOrganizationExcerpt.trim() !== "") ||
      (row.visitReviewSpecialistExcerpt != null &&
        row.visitReviewSpecialistExcerpt.trim() !== "")) ?
      <BookingDoneVisitReviewSummary
        organizationRating={row.visitReviewOrganizationRating}
        specialistRating={row.visitReviewSpecialistRating}
        organizationExcerpt={row.visitReviewOrganizationExcerpt}
        specialistExcerpt={row.visitReviewSpecialistExcerpt}
      />
    : undefined;

  const dateMuted = bookingHistoryDateTagsMuted(row.status);
  const isInProgress = row.status === "in_progress";

  const statusColor =
    row.status === "in_progress" ? "text-primary"
    : row.status === "confirmed" ? "text-emerald-600 dark:text-emerald-400"
    : row.status === "pending" ? "text-amber-600 dark:text-amber-400"
    : row.status === "done" ? "text-muted-foreground"
    : "text-destructive/80";

  const statusDotColor =
    row.status === "in_progress" ? "bg-primary"
    : row.status === "confirmed" ? "bg-emerald-500"
    : row.status === "pending" ? "bg-amber-500"
    : row.status === "done" ? "bg-muted-foreground/40"
    : "bg-destructive/60";

  const clientInitials = row.clientDisplayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const specialistInitials = row.specialistName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const specialistHref =
    row.specialistId.trim() !== "" ? `/specialists/${row.specialistId}` : null;

  return (
    <div
      className={cn(
        "w-full min-w-0 rounded-2xl border border-border/60 bg-card p-4 text-card-foreground",
        isInProgress && "border-l-[3px] border-l-primary",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={cn(dateMuted && "opacity-50")}>
          <p className="font-heading text-base font-semibold tabular-nums leading-tight text-foreground">
            {row.timeRange}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{row.dateLabel}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className={cn("flex items-center gap-1.5 text-xs font-medium", statusColor)}>
            <span className={cn("size-1.5 shrink-0 rounded-full", statusDotColor)} aria-hidden />
            {resolvedStatusLabel}
          </div>
          {row.status === "pending" && countdown != null && (
            <p
              className="text-[0.7rem] tabular-nums text-muted-foreground"
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
          )}
        </div>
      </div>

      <div className="my-3 border-t border-border/40" />

      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar
          src={undefined}
          alt={row.clientDisplayName}
          fallback={clientInitials || "?"}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-sm font-semibold leading-tight text-foreground">
            {row.clientDisplayName}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.serviceLine}</p>
        </div>
      </div>

      {specialistHref != null ?
        <Link
          href={specialistHref}
          className={cn(
            motion.interactivePressStrong,
            "mt-3 flex min-w-0 items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-left outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/45",
          )}
          aria-label={tList("openSpecialistProfile", { name: row.specialistName })}
        >
          <UserAvatar
            src={specialistSalonBookingAvatarSrc(row.specialistImageUrl)}
            alt=""
            fallback={specialistInitials || "?"}
            size="sm"
          />
          <div className="min-w-0">
            <p className="text-[0.65rem] font-medium uppercase tracking-wide leading-none text-muted-foreground/60">
              {t("bookingsCardSpecialistLabel")}
            </p>
            <p className="mt-0.5 truncate text-xs font-medium text-foreground">
              {row.specialistName}
            </p>
          </div>
        </Link>
      : <div className="mt-3 flex min-w-0 items-center gap-2.5 rounded-xl px-1.5 py-1.5">
          <UserAvatar
            src={specialistSalonBookingAvatarSrc(row.specialistImageUrl)}
            alt=""
            fallback={specialistInitials || "?"}
            size="sm"
          />
          <div className="min-w-0">
            <p className="text-[0.65rem] font-medium uppercase tracking-wide leading-none text-muted-foreground/60">
              {t("bookingsCardSpecialistLabel")}
            </p>
            <p className="mt-0.5 truncate text-xs font-medium text-foreground">
              {row.specialistName}
            </p>
          </div>
        </div>
      }

      {secondaryNote != null && (
        <p
          role="note"
          className="mt-3 whitespace-pre-wrap text-xs leading-snug text-muted-foreground break-words"
        >
          {secondaryNote}
        </p>
      )}

      {(pendingActions ?? confirmedActions) != null && (
        <div className="mt-3">{pendingActions ?? confirmedActions}</div>
      )}

      {doneVisitReviewFooter != null && (
        <div className="mt-3">{doneVisitReviewFooter}</div>
      )}
    </div>
  );
}
