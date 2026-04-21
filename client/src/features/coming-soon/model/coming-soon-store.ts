import { create } from "zustand";

type ComingSoonState = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

export const useComingSoonStore = create<ComingSoonState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));

/** Вызов вне React (обработчики, эффекты). */
export function openComingSoon() {
  useComingSoonStore.getState().open();
}

export function closeComingSoon() {
  useComingSoonStore.getState().close();
}
