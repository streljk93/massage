export type CatalogMajorCategoriesListResponseDto = {
  majorCategories: Array<{
    id: string;
    name: string;
    slug: string;
    sortOrder: number;
  }>;
};
