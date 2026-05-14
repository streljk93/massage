import {
  OfferingPublicationStatus,
  PublicationModerationStatus,
  SpecialistOfferingStatus,
} from '@prisma/client';
import {
  directorySpecialistListedBio,
  directorySpecialistListedListingName,
  type SpecialistPublishedRevisionVitrine,
} from './directory-specialist-listed-profile';
import { MARKETPLACE_LISTING_EDGE_SCHEMA_VERSION } from './marketplace-listing-edge-schema-version.const';

/** Источник для индекса рёбер — только OrganizationOffering-graph (без Service). */
export type ListingEdgeSourceRow = {
  id: string;
  specialistId: string;
  status: SpecialistOfferingStatus;
  deletedAt: Date | null;
  priceOverrides: { offeringPriceOptionId: string; customPrice: number }[];
  specialist: {
    id: string;
    gender: string | null;
    listedInDirectory: boolean;
    deletedAt: Date | null;
    reviewsCount: number;
    ratingAverage: unknown;
    createdAt: Date;
    bio: string | null;
    experienceYears: number | null;
    imageUrl: string | null;
    imageAlt: string | null;
    listingName: string | null;
    profilePublicationModerationStatus: PublicationModerationStatus;
    publishedProfileRevision?: SpecialistPublishedRevisionVitrine | null;
  };
  organizationOffering: {
    id: string;
    publicationStatus: OfferingPublicationStatus;
    deletedAt: Date | null;
    title: string;
    category: {
      id: string;
      slug: string;
      majorServiceCategory: { slug: string };
    };
    organization: {
      id: string;
      deletedAt: Date | null;
      publicationModerationStatus: PublicationModerationStatus;
      address: {
        latitude: unknown;
        longitude: unknown;
      } | null;
    };
    priceOptions: {
      id: string;
      priceAmount: number;
      currency: string;
      status: string;
      deletedAt: Date | null;
    }[];
  };
};

/** Документ в коллекцию listing edges (`SpecialistOffering.id` = Typesense document id). */
export function buildMarketplaceListingEdgeDocument(input: {
  row: ListingEdgeSourceRow;
  vitrineCategoryIdsForOrg: Set<string>;
}): Record<string, unknown> | null {
  const { row } = input;
  if (
    row.deletedAt != null ||
    row.status !== SpecialistOfferingStatus.active ||
    row.specialist.deletedAt != null ||
    !row.specialist.listedInDirectory
  ) {
    return null;
  }
  const off = row.organizationOffering;
  if (
    off.deletedAt != null ||
    off.publicationStatus !== OfferingPublicationStatus.published
  ) {
    return null;
  }
  const org = off.organization;
  if (
    org.deletedAt != null ||
    org.publicationModerationStatus !== PublicationModerationStatus.approved
  ) {
    return null;
  }
  if (!input.vitrineCategoryIdsForOrg.has(off.category.id)) {
    return null;
  }
  const overrides = new Map<string, number>();
  for (const o of row.priceOverrides) {
    overrides.set(o.offeringPriceOptionId, o.customPrice);
  }
  const vndAmounts: number[] = [];
  for (const po of off.priceOptions) {
    if (po.deletedAt != null || po.currency.trim().toUpperCase() !== 'VND') {
      continue;
    }
    /* Только активные опции оффера (приходят уже отфильтрованным запросом). */
    const amt = overrides.get(po.id) ?? po.priceAmount;
    if (typeof amt === 'number' && Number.isFinite(amt)) {
      vndAmounts.push(amt);
    }
  }
  if (vndAmounts.length === 0) {
    return null;
  }
  const minPriceVnd = Math.min(...vndAmounts);
  const maxPriceVnd = Math.max(...vndAmounts);

  const listingNameStripped = directorySpecialistListedListingName(
    row.specialist,
  ).trim();
  const bioRaw = directorySpecialistListedBio(row.specialist);
  const bio = bioRaw != null ? bioRaw.trim() : '';

  const latRaw = org.address?.latitude;
  const lngRaw = org.address?.longitude;
  const lat =
    latRaw === null || latRaw === undefined
      ? null
      : Number(latRaw as string | number);
  const lng =
    lngRaw === null || lngRaw === undefined
      ? null
      : Number(lngRaw as string | number);
  let listingGeo: string | undefined;
  if (
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0)
  ) {
    listingGeo = `${lat},${lng}`;
  }

  const ra = Number(row.specialist.ratingAverage);
  const ratingAverage = Number.isFinite(ra) ? ra : 0;

  return {
    schemaVersion: MARKETPLACE_LISTING_EDGE_SCHEMA_VERSION,
    listingKind: 'marketplace_listing_edge',
    specialistId: row.specialist.id,
    organizationOfferingId: off.id,
    organizationId: org.id,
    offeringTitle: off.title.trim(),
    listingName: listingNameStripped,
    bio,
    categorySlug: off.category.slug.trim().toLowerCase(),
    majorSlug: off.category.majorServiceCategory.slug.trim().toLowerCase(),
    minPriceVnd,
    maxPriceVnd,
    specialistReviewsCount: row.specialist.reviewsCount,
    specialistRatingAverage: ratingAverage,
    specialistCreatedAtUnix: Math.floor(
      row.specialist.createdAt.getTime() / 1000,
    ),
    listingEdgeSortKey: row.id,
    gender: row.specialist.gender ?? '',
    listedInDirectory: true,
    listingGeo,
  };
}
