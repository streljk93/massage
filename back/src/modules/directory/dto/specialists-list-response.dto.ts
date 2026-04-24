import type { ListingSlotGroupSeed } from '../domain/listing-slot-groups';
import type { CursorPageMetaDto } from './cursor-page.dto';
import type { DirectoryCategoryTagDto } from './directory-category-tag.dto';

/** Услуги мастера из каталога (`Service` + `ServicePriceOption` по длительности). */
export type SpecialistBookableServiceDto = {
  id: string;
  name: string;
  /** Подкатегория каталога (локализованный `shortName` для `?locale=`). */
  categoryShortName: string;
  durationMinutes: number[];
  /** Суммы в VND, по индексу совпадают с `durationMinutes`. */
  priceVndByDuration: number[];
};

export type SpecialistListItemDto = {
  id: string;
  userId: string;
  name: string;
  bio: string | null;
  experienceYears: number | null;
  /**
   * Уникальные клиенты, у которых есть хотя бы одна неснятая бронь к этому мастеру
   * в статусе `done`.
   */
  doneClientsCount: number;
  ratingAverage: number;
  /** Как в моке карточки: то же, что `ratingAverage`. */
  rating: number;
  reviewsCount: number;
  /** WGS84 — для карты / расстояний (от текущей организации мастера, если задана). */
  latitude: number | null;
  longitude: number | null;
  /** Адрес приёма с точки зрения клиента — у текущей активной организации мастера. */
  addressLine: string | null;
  city: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  metaLine: string;
  servicesLine: string;
  /** Выбранные подкатегории каталога (`?locale` влияет на `shortName`). */
  categories: DirectoryCategoryTagDto[];
  /**
   * **Занятые** слоты (не свободные). Группировка по `calendarDate`, в `times` — HH:mm.
   * На клиенте: свободные = сетка превью витрины минус эти времена.
   */
  slotGroups: ListingSlotGroupSeed[];
  bookableServices: SpecialistBookableServiceDto[];
  /**
   * Новая запись сразу `confirmed` (без `pending` и таймера); иначе клиент ждёт подтверждения мастера.
   * Настраивается на стороне мастера (сид / будущий экран настроек).
   */
  autoConfirmBookings: boolean;
  /**
   * График приёма витрины с активного салона (те же смыслы, что у организации);
   * без места приёма — 8:00–22:00.
   */
  listingWorkdayStartMinute: number;
  listingWorkdayEndMinute: number;
};

export type SpecialistsListResponseDto = {
  specialists: SpecialistListItemDto[];
  cursorPage: CursorPageMetaDto;
};
