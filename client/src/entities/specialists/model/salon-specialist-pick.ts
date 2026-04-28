/** Строка каталога услуг мастера (как в GET /organizations/:id → staff[].bookableServices). */
export type StaffBookableServiceRow = {
  id: string;
  categoryShortName: string;
  durationMinutes: readonly number[];
  priceVndByDuration: readonly number[];
};

/** Снимок специалиста для выбора в контексте организации (салона). */
export type SalonSpecialistPick = {
  specialistId: string;
  name: string;
  imageSrc: string;
  imageAlt: string;
  rating: number;
  metaLine: string;
  /** Пустой массив, если в каталоге нет услуг с ценой. */
  bookableServices: StaffBookableServiceRow[];
  /**
   * Ключи занятых слотов витрины `yyyy-MM-dd|HH:mm` (GET /organizations/:id → staff).
   */
  occupiedListingSlotKeys: readonly string[];
};
