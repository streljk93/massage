import type { ListingSlotGroupSeed } from '../domain/listing-slot-groups';
import type { CursorPageMetaDto } from './cursor-page.dto';
import type { DirectoryCategoryTagDto } from './directory-category-tag.dto';

export type OrganizationListItemDto = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  city: string | null;
  addressLine: string | null;
  phone: string | null;
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
  slotGroups: ListingSlotGroupSeed[];
};

export type OrganizationsListResponseDto = {
  organizations: OrganizationListItemDto[];
  cursorPage: CursorPageMetaDto;
};
