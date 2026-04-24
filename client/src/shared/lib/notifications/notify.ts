import { getToastState } from "./toast-store";
import type { NotificationKind, NotifyOptions } from "./types";

function show(
  kind: NotificationKind,
  title: string,
  description: string | undefined,
  options?: NotifyOptions,
) {
  getToastState().push({
    kind,
    title,
    description,
    duration: options?.duration,
  });
}

/**
 * Единая точка входа для toasts. Не вызывайте `toast()` из shadcn напрямую в фичах/страницах.
 */
export const notify = {
  success: (title: string, description?: string, options?: NotifyOptions) => {
    show("success", title, description, options);
  },
  error: (title: string, description?: string, options?: NotifyOptions) => {
    show("destructive", title, description, options);
  },
  warning: (title: string, description?: string, options?: NotifyOptions) => {
    show("warning", title, description, options);
  },
  info: (title: string, description?: string, options?: NotifyOptions) => {
    show("info", title, description, options);
  },
} as const;
