/** Услуга с вариантами длительности и ценой за каждый вариант (каталог / API). */
export type BookableServiceOption = {
  id: string;
  /** Подкатегория каталога — единственная подпись на карточках (локаль из API). */
  categoryShortName: string;
  /** Вертикаль (`MajorServiceCategory.slug`). */
  majorSlug: string;
  /** Локализованное имя вертикали (переключатель сфер). */
  majorName: string;
  majorSortOrder: number;
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
