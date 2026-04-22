/** Шаг сетки витрины (как на бэкенде). */
export const LISTING_SLOT_STEP_MINUTES = 30;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function slotTimeToMinutes(label: string): number {
  const parts = label.trim().split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return NaN;
  }
  return h * 60 + m;
}

function minutesToSlotLabel(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

/**
 * Оставляет только такие стартовые времена `HH:mm`, для которых хватает
 * следующих ячеек сетки 30 мин под выбранную длительность (как занятость на бэкенде).
 */
export function filterSlotTimesForDuration(
  timeLabels: string[],
  durationMinutes: number,
): string[] {
  if (durationMinutes <= 0 || timeLabels.length === 0) {
    return [];
  }
  const steps = Math.ceil(durationMinutes / LISTING_SLOT_STEP_MINUTES);
  const set = new Set(timeLabels);
  const sorted = [...timeLabels].sort(
    (a, b) => slotTimeToMinutes(a) - slotTimeToMinutes(b),
  );
  return sorted.filter((start) => {
    const startMin = slotTimeToMinutes(start);
    if (Number.isNaN(startMin)) {
      return false;
    }
    let m = startMin;
    for (let i = 1; i < steps; i++) {
      m += LISTING_SLOT_STEP_MINUTES;
      if (!set.has(minutesToSlotLabel(m))) {
        return false;
      }
    }
    return true;
  });
}
