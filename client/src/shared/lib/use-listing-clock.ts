import { useEffect, useState } from "react";

const DEFAULT_INTERVAL_MS = 60_000;

/**
 * «Сейчас» для витрины (Asia/Ho_Chi_Minh) — периодически обновляется, чтобы не показывать
 * прошедшие слоты, если карточка остаётся открытой долго.
 */
export function useListingClock(intervalMs: number = DEFAULT_INTERVAL_MS): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
