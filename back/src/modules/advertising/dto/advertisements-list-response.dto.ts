export type AdvertisementsListResponseDto = {
  placement: string;
  items: Array<{
    id: string;
    ownerKind: 'internal' | 'external';
    sortOrder: number;
    imageUrl: string;
    targetUrl: string | null;
    title: string;
    subtitle: string;
    ctaLabel: string;
  }>;
};
