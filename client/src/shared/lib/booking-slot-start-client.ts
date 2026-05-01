"use client";

import { parseISO } from "date-fns";
import { useEffect, useState } from "react";

/** Совпадает с Nest `BOOKING_START_TOLERANCE_MS` (`listing-slot-policy`). */
export const BOOKING_SLOT_START_TOLERANCE_MS = 120_000;

/** Наступило ли окно «можно начать приём», как на бэкенде для `in_progress`. */
export function bookingSlotStartTimeReachedClient(startsAtIso: string): boolean {
  const t = parseISO(startsAtIso).getTime();
  return Date.now() >= t - BOOKING_SLOT_START_TOLERANCE_MS;
}

/** Редкий пульс, пока есть подтверждённые записи до начала окна — чтобы включить «Начать» без высокочастотного таймера. */
export function useBookingStartWindowPulseWhenWaiting(
  hasConfirmedWaitingWindow: boolean,
): void {
  const [, setPulse] = useState(0);
  useEffect(() => {
    if (!hasConfirmedWaitingWindow) {
      return undefined;
    }
    const id = window.setInterval(() => {
      setPulse((n) => n + 1);
    }, 15_000);
    return () => window.clearInterval(id);
  }, [hasConfirmedWaitingWindow]);
}
