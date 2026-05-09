import {
  ContentModerationCaseKind,
  GalleryMediaKind,
  GalleryOwnerKind,
  type PublicationModerationStatus,
} from '@prisma/client';
import type { Prisma, PrismaClient } from '@prisma/client';

/** Обход устаревших типов `ContentModerationCaseKind` в IDE (нет ключа `specialist_profile`). */
const CONTENT_MOD_KIND_SPECIALIST_PROFILE =
  'specialist_profile' as ContentModerationCaseKind;

/** Одна картинка в галерее владельца (витрина / черновик ревизии). */
export type HydratedGalleryImage = {
  url: string;
  alt: string | null;
};

function emptyGalleryImagesByOwnerMap(): Map<string, HydratedGalleryImage[]> {
  return new Map();
}

/** Все `image`-элементы галереи по `sortOrder`, для решения модератора. */
async function galleryImagesByOwnerIds(
  prisma: PrismaClient,
  ownerKind: GalleryOwnerKind,
  ownerIds: string[],
): Promise<Map<string, HydratedGalleryImage[]>> {
  const out = new Map<string, HydratedGalleryImage[]>();
  const unique = [...new Set(ownerIds)].filter(Boolean);
  if (unique.length === 0) {
    return out;
  }
  const galleries = await prisma.gallery.findMany({
    where: { ownerKind, ownerId: { in: unique } },
    select: {
      ownerId: true,
      items: {
        where: { kind: GalleryMediaKind.image },
        orderBy: { sortOrder: 'asc' },
        select: { url: true, alt: true },
      },
    },
  });
  for (const g of galleries) {
    out.set(
      g.ownerId,
      g.items.map((item) => ({ url: item.url, alt: item.alt ?? null })),
    );
  }
  return out;
}

const organizationHydrationSelect = {
  id: true,
  name: true,
  description: true,
  slug: true,
  publicationModerationStatus: true,
  phone: true,
  email: true,
  website: true,
} as const;

const organizationProfileRevisionHydrationSelect = {
  id: true,
  organizationId: true,
  name: true,
  description: true,
  phone: true,
  email: true,
  website: true,
} as const;

const organizationReviewHydrationSelect = {
  id: true,
  organizationId: true,
  rating: true,
  publishedComment: true,
  pendingCommentDraft: true,
  publicationModerationStatus: true,
} as const;

const specialistReviewHydrationSelect = {
  id: true,
  specialistId: true,
  rating: true,
  publishedComment: true,
  pendingCommentDraft: true,
  publicationModerationStatus: true,
} as const;

const specialistListedHydrationSelect = {
  id: true,
  userId: true,
  listingName: true,
  bio: true,
  experienceYears: true,
  imageUrl: true,
  imageAlt: true,
  profilePublicationModerationStatus: true,
  publishedProfileRevisionId: true,
} as const;

const specialistProfileRevisionHydrationSelect = {
  id: true,
  specialistId: true,
  listingName: true,
  bio: true,
  imageUrl: true,
  imageAlt: true,
  status: true,
} as const;

const userHydrationSelect = {
  id: true,
  name: true,
  catalogListedName: true,
  email: true,
  nameModerationStatus: true,
} as const;

type OrganizationHydrationRow = Prisma.OrganizationGetPayload<{
  select: typeof organizationHydrationSelect;
}>;
type OrganizationProfileRevisionHydrationRow =
  Prisma.OrganizationProfileRevisionGetPayload<{
    select: typeof organizationProfileRevisionHydrationSelect;
  }>;
type OrganizationReviewHydrationRow = Prisma.OrganizationReviewGetPayload<{
  select: typeof organizationReviewHydrationSelect;
}>;
type SpecialistReviewHydrationRow = Prisma.SpecialistReviewGetPayload<{
  select: typeof specialistReviewHydrationSelect;
}>;
type SpecialistListedHydrationRow = Prisma.SpecialistGetPayload<{
  select: typeof specialistListedHydrationSelect;
}>;
type SpecialistProfileRevisionHydrationRow =
  Prisma.SpecialistProfileRevisionGetPayload<{
    select: typeof specialistProfileRevisionHydrationSelect;
  }>;
type UserHydrationRow = Prisma.UserGetPayload<{
  select: typeof userHydrationSelect;
}>;

type OrganizationWithShowcaseGallery = OrganizationHydrationRow & {
  imageUrl: string | null;
  imageAlt: string | null;
  galleryImages: HydratedGalleryImage[];
};
type OrganizationProfileRevisionWithGallery =
  OrganizationProfileRevisionHydrationRow & {
    imageUrl: string | null;
    imageAlt: string | null;
    galleryImages: HydratedGalleryImage[];
  };

/** Минимальные поля кейса для загрузки связанных сущностей постфактум (без Prisma-include). */
export type CaseRowForHydration = {
  id: string;
  kind: ContentModerationCaseKind;
  subjectId: string;
};

/**
 * Подтягивает связанные сущности по `kind` (`organization`, `organizationProfileRevision` для черновика салона, `organizationReview`, …).
 */
export async function hydrateContentModerationCaseRows<
  T extends CaseRowForHydration,
>(
  prisma: PrismaClient,
  rows: T[],
): Promise<
  Array<
    T & {
      organization: {
        id: string;
        name: string;
        description: string | null;
        slug: string;
        publicationModerationStatus: PublicationModerationStatus;
        phone: string | null;
        email: string | null;
        website: string | null;
        /** Обложка = первое фото витринной галереи (как в каталоге). */
        imageUrl: string | null;
        imageAlt: string | null;
        galleryImages: HydratedGalleryImage[];
      } | null;
      organizationProfileRevision: {
        id: string;
        organizationId: string;
        name: string;
        description: string | null;
        phone: string | null;
        email: string | null;
        website: string | null;
        imageUrl: string | null;
        imageAlt: string | null;
        galleryImages: HydratedGalleryImage[];
      } | null;
      organizationReview: {
        id: string;
        organizationId: string;
        rating: number;
        publishedComment: string | null;
        pendingCommentDraft: string | null;
        publicationModerationStatus: PublicationModerationStatus;
      } | null;
      specialistReview: {
        id: string;
        specialistId: string;
        rating: number;
        publishedComment: string | null;
        pendingCommentDraft: string | null;
        publicationModerationStatus: PublicationModerationStatus;
      } | null;
      specialistListedProfile: {
        id: string;
        userId: string;
        listingName: string | null;
        bio: string | null;
        experienceYears: number | null;
        imageUrl: string | null;
        imageAlt: string | null;
        profilePublicationModerationStatus: PublicationModerationStatus;
        publishedProfileRevisionId: string | null;
      } | null;
      targetUser: {
        id: string;
        name: string;
        catalogListedName: string | null;
        email: string;
        nameModerationStatus: PublicationModerationStatus;
      } | null;
    }
  >
> {
  const profileRevisionSubjectIds = [
    ...new Set(
      rows
        .filter(
          (r) => r.kind === ContentModerationCaseKind.organization_profile,
        )
        .map((r) => r.subjectId),
    ),
  ];
  const orgReviewIds = [
    ...new Set(
      rows
        .filter((r) => r.kind === ContentModerationCaseKind.organization_review)
        .map((r) => r.subjectId),
    ),
  ];
  const specialistReviewIds = [
    ...new Set(
      rows
        .filter((r) => r.kind === ContentModerationCaseKind.specialist_review)
        .map((r) => r.subjectId),
    ),
  ];
  const specialistProfileSubjectIds = [
    ...new Set(
      rows
        .filter((r) => r.kind === CONTENT_MOD_KIND_SPECIALIST_PROFILE)
        .map((r) => r.subjectId),
    ),
  ];
  const displayNameUserIds = [
    ...new Set(
      rows
        .filter((r) => r.kind === ContentModerationCaseKind.user_display_name)
        .map((r) => r.subjectId),
    ),
  ];

  const profileRevisions: OrganizationProfileRevisionHydrationRow[] =
    profileRevisionSubjectIds.length > 0
      ? await prisma.organizationProfileRevision.findMany({
          where: { id: { in: profileRevisionSubjectIds } },
          select: organizationProfileRevisionHydrationSelect,
        })
      : [];
  const orgIdsFromRevisions = [
    ...new Set(profileRevisions.map((rev) => rev.organizationId)),
  ];
  const revisionDraftByRevisionId = new Map<
    string,
    OrganizationProfileRevisionHydrationRow
  >(profileRevisions.map((r) => [r.id, r] as const));

  const [
    orgGalleryImagesByOrgId,
    revisionGalleryImagesByRevisionId,
    orgs,
    orgReviews,
    spReviews,
    specialistProfileRevisions,
    users,
  ] = await Promise.all([
    orgIdsFromRevisions.length > 0
      ? galleryImagesByOwnerIds(
          prisma,
          GalleryOwnerKind.organization,
          orgIdsFromRevisions,
        )
      : Promise.resolve(emptyGalleryImagesByOwnerMap()),
    profileRevisionSubjectIds.length > 0
      ? galleryImagesByOwnerIds(
          prisma,
          GalleryOwnerKind.organization_profile_revision,
          profileRevisionSubjectIds,
        )
      : Promise.resolve(emptyGalleryImagesByOwnerMap()),
    orgIdsFromRevisions.length > 0
      ? prisma.organization.findMany({
          where: { id: { in: orgIdsFromRevisions } },
          select: organizationHydrationSelect,
        })
      : ([] as OrganizationHydrationRow[]),
    orgReviewIds.length > 0
      ? prisma.organizationReview.findMany({
          where: { id: { in: orgReviewIds } },
          select: organizationReviewHydrationSelect,
        })
      : ([] as OrganizationReviewHydrationRow[]),
    specialistReviewIds.length > 0
      ? prisma.specialistReview.findMany({
          where: { id: { in: specialistReviewIds } },
          select: specialistReviewHydrationSelect,
        })
      : ([] as SpecialistReviewHydrationRow[]),
    specialistProfileSubjectIds.length > 0
      ? prisma.specialistProfileRevision.findMany({
          where: { id: { in: specialistProfileSubjectIds } },
          select: specialistProfileRevisionHydrationSelect,
        })
      : ([] as SpecialistProfileRevisionHydrationRow[]),
    displayNameUserIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: displayNameUserIds } },
          select: userHydrationSelect,
        })
      : ([] as UserHydrationRow[]),
  ]);

  const specialistIdsFromProfileRevisions = [
    ...new Set(specialistProfileRevisions.map((r) => r.specialistId)),
  ];
  const specialistsForProfileCases =
    specialistIdsFromProfileRevisions.length > 0
      ? await prisma.specialist.findMany({
          where: { id: { in: specialistIdsFromProfileRevisions } },
          select: specialistListedHydrationSelect,
        })
      : ([] as SpecialistListedHydrationRow[]);

  const orgMap = new Map(orgs.map((o) => [o.id, o] as const));
  const orgRevMap = new Map(orgReviews.map((r) => [r.id, r] as const));
  const spRevMap = new Map(spReviews.map((r) => [r.id, r] as const));
  const specialistProfileRevisionById = new Map(
    specialistProfileRevisions.map((r) => [r.id, r] as const),
  );
  const specialistRowById = new Map(
    specialistsForProfileCases.map((s) => [s.id, s] as const),
  );
  const userMap = new Map(users.map((u) => [u.id, u] as const));

  return rows.map((row) => ({
    ...row,
    organization:
      row.kind === ContentModerationCaseKind.organization_profile
        ? (() => {
            const oid = revisionDraftByRevisionId.get(
              row.subjectId,
            )?.organizationId;
            if (oid == null) return null;
            const base = orgMap.get(oid);
            if (base == null) return null;
            const galleryImages =
              orgGalleryImagesByOrgId.get(oid) ??
              ([] as HydratedGalleryImage[]);
            const first = galleryImages[0];
            return {
              ...base,
              imageUrl: first?.url ?? null,
              imageAlt: first?.alt ?? null,
              galleryImages,
            };
          })()
        : null,
    organizationProfileRevision:
      row.kind === ContentModerationCaseKind.organization_profile
        ? (() => {
            const rev = revisionDraftByRevisionId.get(row.subjectId);
            if (rev == null) return null;
            const galleryImages =
              revisionGalleryImagesByRevisionId.get(rev.id) ??
              ([] as HydratedGalleryImage[]);
            const first = galleryImages[0];
            return {
              ...rev,
              imageUrl: first?.url ?? null,
              imageAlt: first?.alt ?? null,
              galleryImages,
            };
          })()
        : null,
    organizationReview:
      row.kind === ContentModerationCaseKind.organization_review
        ? (orgRevMap.get(row.subjectId) ?? null)
        : null,
    specialistReview:
      row.kind === ContentModerationCaseKind.specialist_review
        ? (spRevMap.get(row.subjectId) ?? null)
        : null,
    specialistListedProfile:
      row.kind === CONTENT_MOD_KIND_SPECIALIST_PROFILE
        ? (() => {
            const rev = specialistProfileRevisionById.get(row.subjectId);
            if (rev == null) {
              return null;
            }
            const sp = specialistRowById.get(rev.specialistId);
            if (sp == null) {
              return null;
            }
            return {
              id: sp.id,
              userId: sp.userId,
              listingName: rev.listingName,
              bio: rev.bio,
              experienceYears: sp.experienceYears,
              imageUrl: rev.imageUrl,
              imageAlt: rev.imageAlt,
              profilePublicationModerationStatus:
                sp.profilePublicationModerationStatus,
              publishedProfileRevisionId: sp.publishedProfileRevisionId,
            };
          })()
        : null,
    targetUser:
      row.kind === ContentModerationCaseKind.user_display_name
        ? (userMap.get(row.subjectId) ?? null)
        : null,
  })) as Array<
    T & {
      organization: OrganizationWithShowcaseGallery | null;
      organizationProfileRevision: OrganizationProfileRevisionWithGallery | null;
      organizationReview: OrganizationReviewHydrationRow | null;
      specialistReview: SpecialistReviewHydrationRow | null;
      specialistListedProfile: SpecialistListedHydrationRow | null;
      targetUser: UserHydrationRow | null;
    }
  >;
}
