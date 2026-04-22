import { create } from "zustand";

import type { NotificationKind } from "./types";

const TOAST_LIMIT = 5;
/** ~24 days — long enough to behave like a loading toast; Radix uses duration for the timer. */
const LOADING_LIKE_MS = 2_000_000;

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
  kind: NotificationKind;
  duration: number;
};

type ToastState = {
  toasts: ToastItem[];
  push: (input: {
    title: string;
    description?: string;
    kind: NotificationKind;
    duration?: number;
  }) => string;
  dismiss: (id: string) => void;
};

function mapKindToDuration(_kind: NotificationKind): number {
  return 1_500;
}

export const useNotificationToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: ({ title, description, kind, duration }) => {
    const id =
      globalThis.crypto?.randomUUID() ??
      `toast-${Math.random().toString(36).slice(2, 11)}`;
    const next: ToastItem = {
      id,
      title,
      description,
      kind,
      duration: duration ?? mapKindToDuration(kind),
    };
    set((s) => ({
      toasts: [next, ...s.toasts].slice(0, TOAST_LIMIT),
    }));
    return id;
  },
  dismiss: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

export { LOADING_LIKE_MS };

export function getToastState() {
  return useNotificationToastStore.getState();
}
