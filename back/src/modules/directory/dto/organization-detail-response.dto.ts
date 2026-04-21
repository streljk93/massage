import type { OrganizationListItemDto } from './organizations-list-response.dto';

/** Мастер салона для экрана организации. */
export type OrganizationStaffMemberDto = {
  id: string;
  userId: string;
  name: string;
  rating: number;
  metaLine: string;
  specialtiesLine: string | null;
  imageUrl: string | null;
};

export type OrganizationDetailResponseDto = OrganizationListItemDto & {
  staff: OrganizationStaffMemberDto[];
};
