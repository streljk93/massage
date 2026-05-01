import { useLayoutEffect, useState } from "react";

/**
 * Показывать индикатор только если `active` не пропал в течение `delayMs`.
 * `useLayoutEffect` — таймер стартует до paint, меньше кадра с неверным UI.
 * При быстром ответе индикатор не показываем (нет «моргания»).
 */
export function useDelayedLoadingIndicator(
  active: boolean,
  delayMs = 220,
): boolean {
  const [visible, setVisible] = useState(false);
  useLayoutEffect(() => {
    if (!active) {
      queueMicrotask(() => {
        setVisible(false);
      });
      return;
    }
    const id = window.setTimeout(() => {
      setVisible(true);
    }, delayMs);
    return () => {
      window.clearTimeout(id);
    };
  }, [active, delayMs]);
  return visible;
}
