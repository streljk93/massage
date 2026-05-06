import type { DirectoryCategoryTagDto } from './directory-category-tag.dto';
import type { DirectoryBodyZoneTagDto } from './directory-body-zone-tag.dto';

export type CatalogFilterPriceRangeVndDto = {
  min: number;
  max: number;
};

/** GET /directory/catalog-filter-options */
export type CatalogFilterOptionsResponseDto = {
  categories: DirectoryCategoryTagDto[];
  bodyZones: DirectoryBodyZoneTagDto[];
  genders: Array<'male' | 'female'>;
  /** null — в каталоге нет VND-цен (или для вкладки не применимо). */
  priceRangeVnd: CatalogFilterPriceRangeVndDto | null;
};
