"use client";

import { memo, useCallback, useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import {
  TOAST_RADIX_INTERNAL_TIMER_MIN_MS,
  useNotificationToastStore,
} from "../lib/notifications/toast-store";
import type { NotificationKind } from "../lib/notifications/types";
import {
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastRoot,
  ToastTitle,
  ToastViewport,
} from "./shadcn/toast";

const kindToVariant: Record<NotificationKind, "default" | "destructive" | "success" | "warning" | "info"> =
  {
    default: "default",
    destructive: "destructive",
    success: "success",
    warning: "warning",
    info: "info",
  };

type ToastRowProps = {
  id: string;
  title: string;
  description: string | undefined;
  duration: number;
  variant: "default" | "destructive" | "success" | "warning" | "info";
  onRequestDismiss: (id: string) => void;
};

const NotificationToastRow = memo(function NotificationToastRow({
  id,
  title,
  description,
  duration,
  variant,
  onRequestDismiss,
}: ToastRowProps) {
  const onOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onRequestDismiss(id);
      }
    },
    [id, onRequestDismiss],
  );

  const useRadixInternalTimer = duration >= TOAST_RADIX_INTERNAL_TIMER_MIN_MS;
  const radixDuration = useRadixInternalTimer
    ? duration
    : Number.POSITIVE_INFINITY;

  useEffect(() => {
    if (useRadixInternalTimer) {
      return;
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      return;
    }
    const t = window.setTimeout(() => {
      onRequestDismiss(id);
    }, duration);
    return () => window.clearTimeout(t);
  }, [duration, id, onRequestDismiss, useRadixInternalTimer]);

  return (
    <ToastRoot
      duration={radixDuration}
      type="foreground"
      variant={variant}
      onOpenChange={onOpenChange}
    >
      <div className="grid gap-0.5">
        <ToastTitle>{title}</ToastTitle>
        {description ? <ToastDescription>{description}</ToastDescription> : null}
      </div>
      <ToastClose />
    </ToastRoot>
  );
});

/**
 * Подключает Zustand-состояние к Radix Toast. Монтировать один раз в корне приложения.
 * — одна подписка на store (`useShallow`)
 * — строки тоста в `memo` + стабильный `dismiss`
 */
export function NotificationToaster() {
  const { toasts, dismiss } = useNotificationToastStore(
    useShallow((s) => ({ toasts: s.toasts, dismiss: s.dismiss })),
  );

  const onRequestDismiss = useCallback(
    (toastId: string) => {
      dismiss(toastId);
    },
    [dismiss],
  );

  const rows = useMemo(
    () =>
      toasts.map((t) => {
        const variant = kindToVariant[t.kind];
        return (
          <NotificationToastRow
            key={t.id}
            id={t.id}
            title={t.title}
            description={t.description}
            duration={t.duration}
            variant={variant}
            onRequestDismiss={onRequestDismiss}
          />
        );
      }),
    [toasts, onRequestDismiss],
  );

  return (
    <ToastProvider
      label="Notification"
      duration={2_000}
      swipeDirection="down"
    >
      {rows}
      <ToastViewport />
    </ToastProvider>
  );
}
