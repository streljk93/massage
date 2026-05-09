import {
  type Prisma,
  PublicationModerationStatus,
  SpecialistProfileRevisionStatus,
} from '@prisma/client';

const nonEmptyListingName: Prisma.SpecialistWhereInput = {
  listingName: { not: null },
  NOT: { listingName: '' },
};

/** Снимок витрины с опубликованной ревизии (гость при pending/rejected правке). */
const publishedRevisionHasListingName: Prisma.SpecialistWhereInput = {
  publishedProfileRevision: {
    is: {
      status: SpecialistProfileRevisionStatus.published,
      listingName: { not: null },
      NOT: { listingName: '' },
    },
  },
};

const pendingOrRejected: Prisma.SpecialistWhereInput = {
  profilePublicationModerationStatus: {
    in: [
      PublicationModerationStatus.pending_review,
      PublicationModerationStatus.rejected,
    ],
  },
};
const rowHasVitrineFallback: Prisma.SpecialistWhereInput = {
  AND: [
    { publishedProfileRevisionId: null },
    {
      OR: [
        nonEmptyListingName,
        {
          AND: [{ bio: { not: null } }, { NOT: { bio: '' } }],
        },
        {
          AND: [{ imageUrl: { not: null } }, { NOT: { imageUrl: '' } }],
        },
      ],
    },
  ],
};

/** Каталог показывает мастера, если блок профиля одобрен ИЛИ есть снимок до модерации правки. */
export function specialistProfileListingWhereInput(): Prisma.SpecialistWhereInput {
  return {
    OR: [
      {
        profilePublicationModerationStatus:
          PublicationModerationStatus.approved,
      },
      {
        AND: [
          pendingOrRejected,
          {
            OR: [
              publishedRevisionHasListingName,
              rowHasVitrineFallback,
            ],
          },
        ],
      },
    ],
  };
}

/** Мастер в каталоге: непустое отображаемое имя (одобренное на строке или с опубликованной ревизии). */
export function directoryListedSpecialistListingNameWhereInput(): Prisma.SpecialistWhereInput {
  return {
    OR: [
      {
        AND: [
          {
            profilePublicationModerationStatus:
              PublicationModerationStatus.approved,
          },
          nonEmptyListingName,
        ],
      },
      {
        AND: [
          pendingOrRejected,
          {
            OR: [publishedRevisionHasListingName, nonEmptyListingName],
          },
        ],
      },
    ],
  };
}

/** Поля профиля для резолвера витрины (био / фото / имя каталога + статус публикации + снимок ревизии). */
export type SpecialistVitrinePublicFieldsShape = {
  bio: string | null;
  experienceYears: number | null;
  imageUrl: string | null;
  imageAlt: string | null;
  listingName: string | null;
  profilePublicationModerationStatus: PublicationModerationStatus;
  publishedProfileRevision?: null | Pick<
    SpecialistPublishedRevisionVitrine,
    'listingName' | 'bio' | 'imageUrl' | 'imageAlt' | 'status'
  >;
};

export type SpecialistPublishedRevisionVitrine = {
  listingName: string | null;
  bio: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  status: SpecialistProfileRevisionStatus;
};

function usePublishedRevisionForVitrineFields(
  s: Pick<SpecialistVitrinePublicFieldsShape, 'profilePublicationModerationStatus'>,
): boolean {
  return (
    s.profilePublicationModerationStatus !== PublicationModerationStatus.approved
  );
}

function publishedRevisionPublished(
  rev: SpecialistPublishedRevisionVitrine | null | undefined,
): rev is SpecialistPublishedRevisionVitrine {
  return (
    rev != null && rev.status === SpecialistProfileRevisionStatus.published
  );
}

export function directorySpecialistListedBio(
  s: SpecialistVitrinePublicFieldsShape,
): string | null {
  if (!usePublishedRevisionForVitrineFields(s)) {
    return s.bio;
  }
  if (publishedRevisionPublished(s.publishedProfileRevision)) {
    const fromRev = s.publishedProfileRevision.bio;
    return fromRev !== null ? fromRev : s.bio;
  }
  return s.bio;
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
  if (!usePublishedRevisionForVitrineFields(s)) {
    return s.imageUrl;
  }
  if (publishedRevisionPublished(s.publishedProfileRevision)) {
    const fromRev = s.publishedProfileRevision.imageUrl;
    return fromRev !== null ? fromRev : s.imageUrl;
  }
  return s.imageUrl;
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
  if (publishedRevisionPublished(s.publishedProfileRevision)) {
    const n = (s.publishedProfileRevision.listingName ?? '').trim();
    if (n.length > 0) {
      return n;
    }
  }
  return (s.listingName ?? '').trim();
}
