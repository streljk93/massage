import { create } from "zustand";

import type { ConfirmActionOptions } from "./confirm-options";

type ConfirmSession = (ConfirmActionOptions & { id: string }) | null;

type ConfirmState = {
  open: boolean;
  session: ConfirmSession;
  openConfirm: (options: ConfirmActionOptions) => Promise<boolean>;
  respond: (confirmed: boolean) => void;
  closeWithoutResolve: () => void;
};

let pending: {
  resolve: (v: boolean) => void;
} | null = null;

export const useConfirmActionStore = create<ConfirmState>((set) => ({
  open: false,
  session: null,
  openConfirm: (options) => {
    return new Promise((resolve) => {
      if (pending) {
        pending.resolve(false);
      }
      pending = { resolve };
      const id =
        globalThis.crypto?.randomUUID() ??
        `confirm-${Math.random().toString(36).slice(2, 11)}`;
      set({
        open: true,
        session: { ...options, id },
      });
    });
  },
  respond: (confirmed) => {
    const current = pending;
    if (!current) {
      return;
    }
    current.resolve(confirmed);
    pending = null;
    set({ open: false, session: null });
  },
  closeWithoutResolve: () => {
    if (pending) {
      pending.resolve(false);
      pending = null;
    }
    set({ open: false, session: null });
  },
}));
