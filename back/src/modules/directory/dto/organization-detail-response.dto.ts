import type { OrganizationListItemDto } from './organizations-list-response.dto';
import type { SpecialistBookableServiceDto } from './specialists-list-response.dto';

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
};

export type OrganizationDetailResponseDto = OrganizationListItemDto & {
  staff: OrganizationStaffMemberDto[];
};
