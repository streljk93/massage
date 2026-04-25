import type { CursorPageMetaDto } from './cursor-page.dto';

export type DirectoryReviewItemDto = {
  id: string;
  authorName: string;
  rating: number;
  comment: string | null;
  /** ISO-8601 */
  createdAt: string;
};

export type DirectoryReviewsListResponseDto = {
  items: DirectoryReviewItemDto[];
  cursorPage: CursorPageMetaDto;
};
