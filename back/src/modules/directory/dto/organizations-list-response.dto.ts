import type { ListingSlotGroupSeed } from '../domain/listing-slot-groups';
import type { CursorPageMetaDto } from './cursor-page.dto';
import type { DirectoryCategoryTagDto } from './directory-category-tag.dto';

/** Занятые ячейки витрины по мастеру (каталог салона). */
export type SpecialistOccupiedSlotKeysEntryDto = {
  specialistId: string;
  /** Ключи `yyyy-MM-dd|HH:mm` (Asia/Ho_Chi_Minh). */
  keys: string[];
};

export type OrganizationListItemDto = {
  id: string;
  slug: string;
  /** Сферы деятельности (slug больших категорий), порядок — sortOrder каталога. */
  majorCategorySlugs: string[];
  name: string;
  description: string | null;
  city: string | null;
  addressLine: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  yearsInBusiness: number | null;
  latitude: number | null;
  longitude: number | null;
  ratingAverage: number;
  rating: number;
  reviewsCount: number;
  imageUrl: string | null;
  imageAlt: string | null;
  metaLine: string;
  servicesLine: string;
  /** Выбранные подкатегории каталога (`?locale` влияет на `shortName`). */
  categories: DirectoryCategoryTagDto[];
  /**
   * Для организаций — свободные слоты по календарной доступности мастеров.
   * Для мастеров в legacy-ответах — занятые слоты.
   */
  slotGroups: ListingSlotGroupSeed[];
  /**
   * Занятые ячейки витрины по мастерам, участвующим в каталоге.
   * Клиент строит доступные слоты: время свободно для салона, если оно свободно хотя бы у одного из мастеров.
   */
  specialistOccupiedSlotKeys: SpecialistOccupiedSlotKeysEntryDto[];
  /**
   * Минуты с полуночи (Asia/Ho_Chi_Minh) — график приёма в витрине; сетка слота 30 мин.
   * `end` — окончание приёма (как 22:00, последняя клетка 21:30–22:00).
   */
  listingWorkdayStartMinute: number;
  listingWorkdayEndMinute: number;
};

export type OrganizationsListResponseDto = {
  organizations: OrganizationListItemDto[];
  cursorPage: CursorPageMetaDto;
  /**
   * Сколько карточек соответствует фильтрам запроса (без учёта курсора и размера страницы).
   * Одинаково на каждой странице выдачи.
   */
  matchingCount: number;
};
