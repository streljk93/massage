"use client";

import { useEffect } from "react";

/**
 * Фиксация portrait через Screen Orientation API (часто только после жеста пользователя;
 * в обычной вкладке Safari/iOS lock может быть недоступен — тогда остаётся manifest + viewport).
 */
export function PortraitOrientationLock() {
  useEffect(() => {
    const tryLock = () => {
      const o = screen.orientation as
        | (ScreenOrientation & {
            lock?: (mode: "portrait") => Promise<void>;
          })
        | undefined;
      if (!o?.lock) {
        return;
      }
      void o.lock("portrait").catch(() => {
        /* fullscreen / policy */
      });
    };

    tryLock();
    const onFirstPointer = () => {
      tryLock();
      window.removeEventListener("pointerdown", onFirstPointer, true);
    };
    window.addEventListener("pointerdown", onFirstPointer, true);
    return () => {
      window.removeEventListener("pointerdown", onFirstPointer, true);
    };
  }, []);

  return null;
}
