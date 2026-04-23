/** Метаданные курсорной страницы списка (offset-пагинация — отдельно, если понадобится). */
export type CursorPageMetaDto = {
  nextCursor: string | null;
  hasMore: boolean;
};
