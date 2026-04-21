import type { ListingSlotGroupSeed } from '../domain/listing-slot-groups';
import type { DirectoryCategoryTagDto } from './directory-category-tag.dto';

export type SpecialistListItemDto = {
  id: string;
  userId: string;
  name: string;
  bio: string | null;
  specialtiesLine: string | null;
  experienceYears: number | null;
  ratingAverage: number;
  /** Как в моке карточки: то же, что `ratingAverage`. */
  rating: number;
  reviewsCount: number;
  /** WGS84 — для карты / расстояний. */
  latitude: number | null;
  longitude: number | null;
  /** Адрес приёма (как задал мастер). */
  addressLine: string | null;
  city: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  metaLine: string;
  servicesLine: string;
  /** Выбранные подкатегории каталога (`?locale` влияет на `shortName`). */
  categories: DirectoryCategoryTagDto[];
  slotGroups: ListingSlotGroupSeed[];
};

export type SpecialistsListResponseDto = {
  specialists: SpecialistListItemDto[];
};
