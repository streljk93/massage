"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Геолокацию для карты: первый фикс — только после явного действия пользователя
 * (см. `requestFromUserGesture`), иначе на iOS / WebView нет диалога прав.
 */
export function useUserGeolocation() {
  const [userPosition, setUserPosition] = useState<[number, number] | null>(
    null,
  );
  const watchIdRef = useRef<number | null>(null);

  const startLiveTracking = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    if (watchIdRef.current != null) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setUserPosition([pos.coords.latitude, pos.coords.longitude]);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 25_000 },
    );
  }, []);

  useEffect(() => {
    return () => {
      if (
        watchIdRef.current != null &&
        typeof navigator !== "undefined" &&
        navigator.geolocation
      ) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  /**
   * Важно: вызывать только синхронно из `onClick` / `onPointerDown` того же компонента,
   * без `setTimeout`/`await` до вызова — иначе Safari сбрасывает user activation.
   */
  const requestFromUserGesture = useCallback(
    (onFix: (p: [number, number]) => void) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const p: [number, number] = [
            pos.coords.latitude,
            pos.coords.longitude,
          ];
          setUserPosition(p);
          startLiveTracking();
          onFix(p);
        },
        () => {},
        {
          enableHighAccuracy: true,
          maximumAge: 60_000,
          timeout: 15_000,
        },
      );
    },
    [startLiveTracking],
  );

  return { userPosition, requestFromUserGesture };
}
