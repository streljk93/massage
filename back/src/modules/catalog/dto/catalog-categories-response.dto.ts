export type CatalogCategoriesResponseDto = {
  majorCategory: {
    id: string;
    name: string;
    slug: string;
  };
  categories: Array<{
    id: string;
    name: string;
    shortName: string;
    slug: string;
    description: string | null;
    sortOrder: number;
  }>;
};

/** Несколько секций «большая категория + подкатегории» за один запрос. */
export type CatalogBulkCategoriesResponseDto = {
  sections: CatalogCategoriesResponseDto[];
};
