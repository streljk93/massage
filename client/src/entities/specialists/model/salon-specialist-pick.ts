/** Строка каталога услуг мастера (как в GET /organizations/:id → staff[].bookableServices). */
export type StaffBookableServiceRow = {
  id: string;
  categoryShortName: string;
  majorSlug: string;
  majorName: string;
  majorSortOrder: number;
  durationMinutes: readonly number[];
  priceVndByDuration: readonly number[];
  organizationOfferingId: string;
  marketplaceOfferingPriceOptionIds: readonly string[];
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
  /**
   * Ключи доступных слотов витрины по рабочему календарю мастера.
   */
  availableListingSlotKeys: readonly string[];
};
