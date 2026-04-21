/** Услуга с вариантами длительности и ценой за каждый вариант (каталог / API). */
export type BookableServiceOption = {
  id: string;
  /** Локализованное название (из API или мока). */
  title: string;
  durationMinutes: readonly number[];
  /** Длина совпадает с `durationMinutes`: цена в VND за сессию. */
  priceVndByDuration: readonly number[];
};

/** Текущая цена услуги для выбранной длительности (минут). */
export function priceForDuration(
  service: BookableServiceOption,
  minutes: number,
): number {
  const i = service.durationMinutes.indexOf(minutes);
  if (i === -1) {
    return service.priceVndByDuration[0] ?? 0;
  }
  return service.priceVndByDuration[i] ?? service.priceVndByDuration[0] ?? 0;
}
