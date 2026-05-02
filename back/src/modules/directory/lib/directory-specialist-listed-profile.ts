import { type Prisma, PublicationModerationStatus } from '@prisma/client';

/** Каталог показывает мастера, если блок профиля одобрен ИЛИ висит кейс поверх опубликованного снимка. */
export function specialistProfileListingWhereInput(): Prisma.SpecialistWhereInput {
  const hasFrozenVitrineSnapshot: Prisma.SpecialistWhereInput = {
    OR: [
      { catalogListedBio: { not: null } },
      { catalogListedImageUrl: { not: null } },
      { catalogListedListingName: { not: null } },
    ],
  };
  const hasPublishedRevisionPointer: Prisma.SpecialistWhereInput = {
    publishedProfileRevisionId: { not: null },
  };
  return {
    OR: [
      {
        profilePublicationModerationStatus:
          PublicationModerationStatus.approved,
      },
      {
        AND: [
          {
            profilePublicationModerationStatus:
              PublicationModerationStatus.pending_review,
          },
          {
            OR: [hasFrozenVitrineSnapshot, hasPublishedRevisionPointer],
          },
        ],
      },
      {
        AND: [
          {
            profilePublicationModerationStatus:
              PublicationModerationStatus.rejected,
          },
          {
            OR: [hasFrozenVitrineSnapshot, hasPublishedRevisionPointer],
          },
        ],
      },
    ],
  };
}

/** Мастер в каталоге: при одобренном профиле — живое `listingName`; при правке на модерации — заморозка `catalogListedListingName` или опубликованная строка по `publishedProfileRevisionId`. */
export function directoryListedSpecialistListingNameWhereInput(): Prisma.SpecialistWhereInput {
  return {
    OR: [
      {
        AND: [
          {
            profilePublicationModerationStatus:
              PublicationModerationStatus.approved,
          },
          { listingName: { not: null } },
          { NOT: { listingName: '' } },
        ],
      },
      {
        AND: [
          {
            profilePublicationModerationStatus:
              PublicationModerationStatus.pending_review,
          },
          { catalogListedListingName: { not: null } },
          { NOT: { catalogListedListingName: '' } },
        ],
      },
      {
        AND: [
          {
            profilePublicationModerationStatus:
              PublicationModerationStatus.pending_review,
          },
          { publishedProfileRevisionId: { not: null } },
          { listingName: { not: null } },
          { NOT: { listingName: '' } },
        ],
      },
      {
        AND: [
          {
            profilePublicationModerationStatus:
              PublicationModerationStatus.rejected,
          },
          { catalogListedListingName: { not: null } },
          { NOT: { catalogListedListingName: '' } },
        ],
      },
      {
        AND: [
          {
            profilePublicationModerationStatus:
              PublicationModerationStatus.rejected,
          },
          { publishedProfileRevisionId: { not: null } },
          { listingName: { not: null } },
          { NOT: { listingName: '' } },
        ],
      },
    ],
  };
}

/** Поля профиля, участвующие во витрине (био / фото / имя каталога + статус публикации). */
export type SpecialistVitrinePublicFieldsShape = {
  bio: string | null;
  experienceYears: number | null;
  imageUrl: string | null;
  imageAlt: string | null;
  listingName: string | null;
  catalogListedListingName: string | null;
  profilePublicationModerationStatus: PublicationModerationStatus;
  catalogListedBio: string | null;
  catalogListedImageUrl: string | null;
};

function useFrozenCatalogSnapshotForProfileFields(
  s: Pick<
    SpecialistVitrinePublicFieldsShape,
    'profilePublicationModerationStatus'
  >,
): boolean {
  return (
    s.profilePublicationModerationStatus !==
    PublicationModerationStatus.approved
  );
}

export function directorySpecialistListedBio(
  s: SpecialistVitrinePublicFieldsShape,
): string | null {
  if (!useFrozenCatalogSnapshotForProfileFields(s)) {
    return s.bio;
  }
  const f = s.catalogListedBio;
  return f !== null ? f : s.bio;
}

/** Опыт задаётся выбором в онбординге — всегда «живое» значение, без заморозки каталога. */
export function directorySpecialistListedExperienceYears(
  s: SpecialistVitrinePublicFieldsShape,
): number | null {
  return s.experienceYears;
}

export function directorySpecialistListedImageUrl(
  s: SpecialistVitrinePublicFieldsShape,
): string | null {
  if (!useFrozenCatalogSnapshotForProfileFields(s)) {
    return s.imageUrl;
  }
  const f = s.catalogListedImageUrl;
  return f !== null ? f : s.imageUrl;
}

/** Alt — не модерируемый текст; для гостя совпадает с текущим полем специалиста. */
export function directorySpecialistListedImageAlt(
  s: SpecialistVitrinePublicFieldsShape,
): string | null {
  return s.imageAlt;
}

export function directorySpecialistListedListingName(
  s: SpecialistVitrinePublicFieldsShape,
): string {
  if (
    s.profilePublicationModerationStatus ===
    PublicationModerationStatus.approved
  ) {
    return (s.listingName ?? '').trim();
  }
  const frozen = (s.catalogListedListingName ?? '').trim();
  if (
    (s.profilePublicationModerationStatus ===
      PublicationModerationStatus.pending_review ||
      s.profilePublicationModerationStatus ===
        PublicationModerationStatus.rejected) &&
    frozen.length > 0
  ) {
    return frozen;
  }
  return (s.listingName ?? '').trim();
}
