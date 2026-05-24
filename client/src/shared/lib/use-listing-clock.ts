import { useEffect, useState } from "react";

const DEFAULT_INTERVAL_MS = 60_000;

/**
 * «Сейчас» для витрины (Asia/Ho_Chi_Minh) — периодически обновляется, чтобы не показывать
 * прошедшие слоты, если карточка остаётся открытой долго.
 * `initialNowIso` с SSR — один снимок времени для гидрации.
 */
export function useListingClock(
  intervalMs: number = DEFAULT_INTERVAL_MS,
  initialNowIso?: string,
): Date {
  const [now, setNow] = useState(
    () => new Date(initialNowIso ?? Date.now()),
  );
  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
