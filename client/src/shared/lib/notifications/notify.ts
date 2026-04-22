import { getToastState } from "./toast-store";
import type { NotificationKind } from "./types";

function show(kind: NotificationKind, title: string, description?: string) {
  getToastState().push({ kind, title, description });
}

/**
 * Единая точка входа для toasts. Не вызывайте `toast()` из shadcn напрямую в фичах/страницах.
 */
export const notify = {
  success: (title: string, description?: string) => {
    show("success", title, description);
  },
  error: (title: string, description?: string) => {
    show("destructive", title, description);
  },
  warning: (title: string, description?: string) => {
    show("warning", title, description);
  },
  info: (title: string, description?: string) => {
    show("info", title, description);
  },
} as const;
