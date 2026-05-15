import type { PublicationModerationStatus } from '@prisma/client';
import type { OrganizationListItemDto } from './organizations-list-response.dto';
import type { SpecialistBookableServiceDto } from './specialists-list-response.dto';

/** Элемент витринной галереи салона (порядок как в кабинете). */
export type OrganizationVitrineGalleryItemDto = {
  url: string;
  alt: string | null;
};

/** Мастер салона для экрана организации. */
export type OrganizationStaffMemberDto = {
  id: string;
  userId: string;
  name: string;
  rating: number;
  metaLine: string;
  imageUrl: string | null;
  /** Как в GET /specialists/:id — услуги мастера (свои + fallback каталога салона). */
  bookableServices: SpecialistBookableServiceDto[];
  /**
   * Ключи занятых ячеек витрины `yyyy-MM-dd|HH:mm` (Asia/Ho_Chi_Minh), как у расчёта слотов.
   * Нужны клиенту, чтобы скрыть мастера при выбранном слоте, если интервал пересекается с бронью.
   */
  occupiedListingSlotKeys: string[];
  /**
   * Ключи доступных ячеек витрины `yyyy-MM-dd|HH:mm` по календарю мастера.
   * Интервал записи можно предлагать мастеру только если все его ячейки есть здесь.
   */
  availableListingSlotKeys: string[];
};

export type OrganizationDetailResponseDto = OrganizationListItemDto & {
  staff: OrganizationStaffMemberDto[];
  /**
   * Уникальные пользователи с хотя бы одной бронью в статусе `done` у этого салона.
   */
  clientsCount: number;
  /** Фото витрины (пусто, если галерея не создана). */
  vitrineGalleryItems: OrganizationVitrineGalleryItemDto[];
  /**
   * Только для владельца салона, пока профиль не одобрен: статус модерации витрины.
   */
  publicationModerationStatus?: PublicationModerationStatus;
};
