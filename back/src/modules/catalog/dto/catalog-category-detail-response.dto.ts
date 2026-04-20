import type { CatalogCategoriesResponseDto } from './catalog-categories-response.dto';

/** Одна активная подкатегория в контексте большой категории (имена по запрошенной локали). */
export type CatalogCategoryDetailResponseDto = {
  majorCategory: CatalogCategoriesResponseDto['majorCategory'];
  category: CatalogCategoriesResponseDto['categories'][number];
};
