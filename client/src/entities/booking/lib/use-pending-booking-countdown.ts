"use client";

import { differenceInMilliseconds, isValid, parseISO } from "date-fns";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type PendingCountdownParts = {
  minutes: number;
  seconds: number;
};

/**
 * Обратный отсчёт до `expiresAtIso`: целые минуты и секунды (удобно для подписей «мин / сек» в i18n).
 * `onExpired` вызывается один раз при переходе через ноль (в т.ч. если дедлайн уже в прошлом при маунте).
 */
export function usePendingBookingCountdown(
  expiresAtIso: string | null | undefined,
  enabled: boolean,
  onExpired?: () => void,
): PendingCountdownParts | null {
  const onExpiredRef = useRef(onExpired);
  useLayoutEffect(() => {
    onExpiredRef.current = onExpired;
  }, [onExpired]);

  const firedRef = useRef(false);
  const [, setPulse] = useState(0);

  useEffect(() => {
    firedRef.current = false;
    if (!enabled || !expiresAtIso) {
      return;
    }
    const deadlineDate = parseISO(expiresAtIso);
    if (!isValid(deadlineDate)) {
      return;
    }
    const deadline = deadlineDate.getTime();

    const tryExpire = () => {
      if (Date.now() < deadline || firedRef.current) {
        return;
      }
      firedRef.current = true;
      onExpiredRef.current?.();
    };

    if (Date.now() >= deadline) {
      tryExpire();
      return;
    }

    const id = window.setInterval(() => {
      setPulse((n) => n + 1);
      tryExpire();
    }, 1000);
    return () => window.clearInterval(id);
  }, [enabled, expiresAtIso]);

  if (!enabled || !expiresAtIso) {
    return null;
  }
  // eslint-disable-next-line react-hooks/purity -- wall-clock countdown; `pulse` обновляется раз в секунду
  const deadlineDate = parseISO(expiresAtIso);
  if (!isValid(deadlineDate)) {
    return null;
  }
  const ms = differenceInMilliseconds(deadlineDate, new Date());
  if (Number.isNaN(ms)) {
    return null;
  }
  if (ms <= 0) {
    return { minutes: 0, seconds: 0 };
  }
  const totalSec = Math.floor(ms / 1000);
  return {
    minutes: Math.floor(totalSec / 60),
    seconds: totalSec % 60,
  };
}
