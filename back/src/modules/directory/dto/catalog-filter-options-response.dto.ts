import type { DirectoryCategoryTagDto } from './directory-category-tag.dto';

export type CatalogFilterPriceRangeVndDto = {
  min: number;
  max: number;
};

/** GET /directory/catalog-filter-options */
export type CatalogFilterOptionsResponseDto = {
  categories: DirectoryCategoryTagDto[];
  /** null — в каталоге нет VND-цен (или для вкладки не применимо). */
  priceRangeVnd: CatalogFilterPriceRangeVndDto | null;
};
