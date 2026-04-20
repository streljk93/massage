/** Услуга с выбором длительности и ценой за каждый вариант (демо / будущий API). */
export type BookableServiceOption = {
  id: string;
  nameKey: "footMassage" | "relaxMassage";
  durationMinutes: readonly number[];
  /** Длина массива совпадает с `durationMinutes`: цена в VND за сессию. */
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
