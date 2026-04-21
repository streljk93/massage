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
};

export type OrganizationDetailResponseDto = OrganizationListItemDto & {
  staff: OrganizationStaffMemberDto[];
};
