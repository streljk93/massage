export type WorkplaceOrganizationSearchItemDto = {
  id: string;
  name: string;
  addressLine: string | null;
  city: string | null;
};

export type WorkplaceOrganizationSearchResponseDto = {
  organizations: WorkplaceOrganizationSearchItemDto[];
};
