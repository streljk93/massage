"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { parseISO } from "date-fns";
import { useTranslations } from "next-intl";
import {
  calendarCreateBlock,
  calendarDeleteBlock,
  calendarUpdateBlock,
  type createBrowserSdkClient,
} from "@/shared/api";
import type { CalendarEvent, CalendarResource } from "@/widgets/calendar";
import {
  LISTING_DISPLAY_TZ,
  vnWallClockToUtcDate,
} from "@/shared/lib/datetime/vn-listing-datetime";
import { notify } from "@/shared/lib/notifications";
import { cn } from "@/shared/lib";
import { Textarea } from "@/shared/ui";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/shadcn/dialog";
import { Button } from "@/shared/ui/shadcn/button";

// ─── Types ────────────────────────────────────────────────────────

export type { CalendarEvent, CalendarResource };

type SdkClient = ReturnType<typeof createBrowserSdkClient>;
type BlockReason = "break" | "vacation" | "manual";

/** Состояние диалога, передаётся снаружи. */
export type CalendarBlockDialogState =
  | { type: "closed" }
  | {
      type: "create";
      dayKey: string;
      startHHMM: string;
      endHHMM: string;
      defaultResourceId: string;
    }
  | {
      type: "edit";
      event: CalendarEvent;
      dayKey: string;
    }
  | {
      type: "detail";
      event: CalendarEvent;
    };

// ─── Helpers ──────────────────────────────────────────────────────

function localTimeToUtcISO(dayKey: string, hhMM: string): string {
  const [h, m] = hhMM.split(":").map(Number);
  const [y, mo, d] = dayKey.split("-").map(Number);
  return vnWallClockToUtcDate(y, mo, d, h ?? 0, m ?? 0).toISOString();
}

function utcIsoToLocalHHMM(iso: string): string {
  const date = parseISO(iso);
  const h = String(
    Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: LISTING_DISPLAY_TZ,
        hour: "2-digit",
        hour12: false,
      }).format(date),
    ),
  ).padStart(2, "0");
  const m = String(
    Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: LISTING_DISPLAY_TZ,
        minute: "2-digit",
      }).format(date),
    ),
  ).padStart(2, "0");
  return `${h}:${m}`;
}

// ─── Booking detail view ──────────────────────────────────────────

function BookingDetailContent({
  event,
  onClose,
}: {
  event: CalendarEvent;
  onClose: () => void;
}) {
  const t = useTranslations("businessCalendarPage");
  const tw = useTranslations("calendarWidget");
  const b = event.booking;
  const startHHMM = utcIsoToLocalHHMM(event.startsAt);
  const endHHMM = utcIsoToLocalHHMM(event.endsAt);
  const dur = Math.round(
    (parseISO(event.endsAt).getTime() - parseISO(event.startsAt).getTime()) / 60_000,
  );

  /** Завершённые визиты в календаре имеют `event.status === "cancelled"` (не блокируют слот). */
  const uiStatus =
    b?.status === "done" ? "done" : (event.status ?? "pending");

  const statusDot: Record<string, string> = {
    pending: "bg-sky-400",
    confirmed: "bg-violet-500",
    in_progress: "bg-emerald-500",
    done: "bg-slate-400",
    cancelled: "bg-muted-foreground/40",
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span
            className={cn(
              "size-2.5 shrink-0 rounded-full",
              statusDot[uiStatus] ?? "bg-primary/40",
            )}
          />
          {b?.clientDisplayName ?? tw("booking")}
        </DialogTitle>
      </DialogHeader>
      <div className="grid gap-3 py-1">
        {b?.categoryShortName && (
          <div className="rounded-lg bg-muted/40 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">{t("detail.service")}</p>
            <p className="mt-0.5 text-sm font-medium">{b.categoryShortName}</p>
          </div>
        )}
        <div className="rounded-lg bg-muted/40 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">{t("detail.time")}</p>
          <p className="mt-0.5 text-sm font-medium tabular-nums">
            {startHHMM} — {endHHMM}{" "}
            <span className="text-muted-foreground">
              · {tw("durationMin", { value: dur })}
            </span>
          </p>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">{t("detail.status")}</p>
          <p className="mt-0.5 text-sm font-medium">
            {tw(`status.${uiStatus}`)}
          </p>
        </div>
        {b?.specialistName && (
          <div className="rounded-lg bg-muted/40 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">{t("detail.specialist")}</p>
            <p className="mt-0.5 text-sm font-medium">{b.specialistName}</p>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button type="button" onClick={onClose}>
          {t("dialog.close")}
        </Button>
      </DialogFooter>
    </>
  );
}

// ─── Block form (keyed sub-component for fresh state) ─────────────

function BlockFormContent({
  state,
  resources,
  sdk,
  onClose,
  onSuccess,
}: {
  state:
    | Extract<CalendarBlockDialogState, { type: "create" }>
    | Extract<CalendarBlockDialogState, { type: "edit" }>;
  resources: CalendarResource[];
  sdk: SdkClient;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useTranslations("businessCalendarPage");
  const tw = useTranslations("calendarWidget");
  const isEdit = state.type === "edit";

  const [startTime, setStartTime] = useState<string>(
    isEdit ? utcIsoToLocalHHMM(state.event.startsAt) : state.startHHMM,
  );
  const [endTime, setEndTime] = useState<string>(
    isEdit ? utcIsoToLocalHHMM(state.event.endsAt) : state.endHHMM,
  );
  const [reason, setReason] = useState<BlockReason>(
    isEdit ? ((state.event.blockReason as BlockReason) ?? "manual") : "manual",
  );
  const [notes, setNotes] = useState<string>(
    isEdit ? (state.event.notes ?? "") : "",
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(
    isEdit
      ? state.event.resources.map((r) => r.id)
      : [state.defaultResourceId].filter(Boolean),
  );
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dayKey = state.type === "edit"
    ? state.dayKey
    : state.dayKey;

  function toggleResource(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
    setFieldError(null);
  }

  async function handleSubmit() {
    setFieldError(null);
    if (!startTime || !endTime) {
      setFieldError(t("dialog.validationTime"));
      return;
    }
    if (startTime >= endTime) {
      setFieldError(t("dialog.validationTimeOrder"));
      return;
    }
    if (selectedIds.length === 0) {
      setFieldError(t("dialog.validationResource"));
      return;
    }
    const startsAt = localTimeToUtcISO(dayKey, startTime);
    const endsAt = localTimeToUtcISO(dayKey, endTime);
    setBusy(true);
    try {
      if (state.type === "create") {
        const { error } = await calendarCreateBlock({
          client: sdk,
          body: {
            startsAt,
            endsAt,
            resourceIds: selectedIds,
            blockReason: reason,
            ...(notes.trim() ? { notes: notes.trim() } : {}),
          },
        });
        if (error) throw error;
        notify.success(t("dialog.createSuccess"));
      } else {
        const { error } = await calendarUpdateBlock({
          client: sdk,
          path: { id: state.event.id },
          body: {
            startsAt,
            endsAt,
            resourceIds: selectedIds,
            blockReason: reason,
            notes: notes.trim() || null,
            version: state.event.version,
          },
        });
        if (error) throw error;
        notify.success(t("dialog.updateSuccess"));
      }
      onSuccess();
      onClose();
    } catch {
      setFieldError(t("dialog.saveError"));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (state.type !== "edit") return;
    setBusy(true);
    try {
      const { error } = await calendarDeleteBlock({
        client: sdk,
        path: { id: state.event.id },
        query: { version: state.event.version },
      });
      if (error) throw error;
      notify.success(t("dialog.deleteSuccess"));
      onSuccess();
      onClose();
    } catch {
      setFieldError(t("dialog.deleteError"));
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  }

  const REASONS: BlockReason[] = ["break", "vacation", "manual"];

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {isEdit ? t("dialog.editTitle") : t("dialog.createTitle")}
        </DialogTitle>
      </DialogHeader>

      <div className="grid gap-4 py-1">
        {/* Time range */}
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t("dialog.startTime")}
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value);
                setFieldError(null);
              }}
              disabled={busy}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t("dialog.endTime")}
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => {
                setEndTime(e.target.value);
                setFieldError(null);
              }}
              disabled={busy}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Block reason */}
        <div className="grid gap-2">
          <label className="text-xs font-medium text-muted-foreground">
            {t("dialog.reasonLabel")}
          </label>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                disabled={busy}
                onClick={() => setReason(r)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                  reason === r
                    ? "border-amber-400 bg-amber-50 text-amber-900"
                    : "border-border/50 bg-card text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {tw(`blockReason.${r}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Resources — only show selector when there are multiple */}
        {resources.length > 1 && (
          <div className="grid gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t("dialog.resourcesLabel")}
            </label>
            <div className="flex flex-col gap-2">
              {resources.map((r) => (
                <label
                  key={r.id}
                  className="flex cursor-pointer items-center gap-2.5"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(r.id)}
                    onChange={() => toggleResource(r.id)}
                    disabled={busy}
                    className="size-4 accent-primary"
                  />
                  <span className="text-sm">{r.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t("dialog.notesLabel")}
          </label>
          <Textarea
            rows={2}
            disabled={busy}
            placeholder={t("dialog.notesPlaceholder")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[3.5rem] resize-none rounded-lg text-sm"
          />
        </div>

        {fieldError && (
          <p className="text-sm text-destructive" role="alert">
            {fieldError}
          </p>
        )}
      </div>

      <DialogFooter>
        {/* Delete action (edit mode) */}
        {isEdit && (
          <div className="mr-auto flex items-center gap-2">
            {confirmDelete ? (
              <>
                <span className="text-xs text-muted-foreground">
                  {t("dialog.confirmDelete")}
                </span>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={busy}
                  onClick={() => void handleDelete()}
                >
                  {t("dialog.deleteConfirmYes")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setConfirmDelete(false)}
                >
                  {t("dialog.deleteConfirmNo")}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                {t("dialog.deleteButton")}
              </Button>
            )}
          </div>
        )}

        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={onClose}
        >
          {t("dialog.cancel")}
        </Button>
        <Button
          type="button"
          disabled={busy}
          aria-busy={busy}
          onClick={() => void handleSubmit()}
        >
          {isEdit ? t("dialog.saveButton") : t("dialog.createButton")}
        </Button>
      </DialogFooter>
    </>
  );
}

// ─── Public export ────────────────────────────────────────────────

export function BusinessCalendarBlockDialog({
  state,
  resources,
  sdk,
  onClose,
  onSuccess,
  renderBookingDetail,
}: {
  state: CalendarBlockDialogState;
  resources: CalendarResource[];
  sdk: SdkClient;
  onClose: () => void;
  onSuccess: () => void;
  /**
   * Кастомное содержимое для просмотра брони; иначе — краткий read-only просмотр.
   * Слой календаря не знает о записях: сценарий подключает карточку снаружи.
   */
  renderBookingDetail?: (
    event: CalendarEvent,
    ctx: { onClose: () => void },
  ) => ReactNode;
}) {
  const isOpen = state.type !== "closed";

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[440px]">
        {state.type === "detail" ? (
          state.event.type === "booking" && renderBookingDetail != null ? (
            renderBookingDetail(state.event, { onClose })
          ) : (
            <BookingDetailContent
              key={state.event.id}
              event={state.event}
              onClose={onClose}
            />
          )
        ) : state.type === "create" || state.type === "edit" ? (
          <BlockFormContent
            key={
              state.type === "edit"
                ? `edit-${state.event.id}-${state.event.version}`
                : `create-${state.startHHMM}-${state.defaultResourceId}`
            }
            state={state}
            resources={resources}
            sdk={sdk}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
