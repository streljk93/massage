import type { CursorPageMetaDto } from './cursor-page.dto';

export type DirectoryReviewItemDto = {
  id: string;
  authorName: string;
  rating: number;
  comment: string | null;
  /** ISO-8601 */
  createdAt: string;
  /**
   * Только для отзыва автора, пока текст не одобрен: `pending_review` / `rejected`.
   * Для гостей в ленте всегда одобренные отзывы — поле отсутствует.
   */
  publicationModerationStatus?: 'approved' | 'pending_review' | 'rejected';
};

export type DirectoryReviewsListResponseDto = {
  items: DirectoryReviewItemDto[];
  cursorPage: CursorPageMetaDto;
};
