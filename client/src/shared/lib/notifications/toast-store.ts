import { create } from "zustand";

import { randomUuid } from "../random-uuid";

import type { NotificationKind } from "./types";

const TOAST_LIMIT = 5;
/** ~24 days — long enough to behave like a loading toast; Radix uses duration for the timer. */
const LOADING_LIKE_MS = 2_000_000;

/**
 * `duration` ниже — закрытие несёт `NotificationToastRow` (свой setTimeout + `duration={∞}` в Radix),
 * потому что у Radix Toasts таймер **ставится на паузу** при движении курсора / фокусе в зоне viewport
 * и буквальные 2s по факту не срабатывают. От порога вверх — внутри Radix (лоадер 2M ms).
 */
export const TOAST_RADIX_INTERNAL_TIMER_MIN_MS = 1_000_000;

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

const DEFAULT_TOAST_MS = 2_000;

function mapKindToDuration(): number {
  return DEFAULT_TOAST_MS;
}

export const useNotificationToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: ({ title, description, kind, duration }) => {
    const id = randomUuid();
    const next: ToastItem = {
      id,
      title,
      description,
      kind,
      duration: duration ?? mapKindToDuration(),
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
