import {
  ContentModerationCaseKind,
  type PublicationModerationStatus,
} from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

/** Минимальные поля кейса для загрузки связанных сущностей постфактум (без Prisma-include). */
export type CaseRowForHydration = {
  id: string;
  kind: ContentModerationCaseKind;
  subjectId: string;
};

/**
 * Подтягивает `organization`, `organizationReview`, `specialistReview`, `targetUser` как раньше
 * при включённом `include`. Ровно одно из полей не null согласно `kind`; остальные — null.
 */
export async function hydrateContentModerationCaseRows<
  T extends CaseRowForHydration,
>(
  prisma: PrismaClient,
  rows: T[],
): Promise<
  Array<
    T & {
      organization:
        | {
            id: string;
            name: string;
            description: string | null;
            slug: string;
            publicationModerationStatus: PublicationModerationStatus;
          }
        | null;
      organizationReview:
        | {
            id: string;
            organizationId: string;
            rating: number;
            comment: string | null;
            publicationModerationStatus: PublicationModerationStatus;
          }
        | null;
      specialistReview:
        | {
            id: string;
            specialistId: string;
            rating: number;
            comment: string | null;
            publicationModerationStatus: PublicationModerationStatus;
          }
        | null;
      targetUser:
        | {
            id: string;
            name: string;
            email: string;
            nameModerationStatus: PublicationModerationStatus;
          }
        | null;
    }
  >
> {
  const orgProfileIds = [
    ...new Set(
      rows
        .filter((r) => r.kind === ContentModerationCaseKind.organization_profile)
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
  const displayNameUserIds = [
    ...new Set(
      rows
        .filter((r) => r.kind === ContentModerationCaseKind.user_display_name)
        .map((r) => r.subjectId),
    ),
  ];

  const [orgs, orgReviews, spReviews, users] = await Promise.all([
    orgProfileIds.length > 0 ?
      prisma.organization.findMany({
        where: { id: { in: orgProfileIds } },
        select: {
          id: true,
          name: true,
          description: true,
          slug: true,
          publicationModerationStatus: true,
        },
      })
    : [],
    orgReviewIds.length > 0 ?
      prisma.organizationReview.findMany({
        where: { id: { in: orgReviewIds } },
        select: {
          id: true,
          organizationId: true,
          rating: true,
          comment: true,
          publicationModerationStatus: true,
        },
      })
    : [],
    specialistReviewIds.length > 0 ?
      prisma.specialistReview.findMany({
        where: { id: { in: specialistReviewIds } },
        select: {
          id: true,
          specialistId: true,
          rating: true,
          comment: true,
          publicationModerationStatus: true,
        },
      })
    : [],
    displayNameUserIds.length > 0 ?
      prisma.user.findMany({
        where: { id: { in: displayNameUserIds } },
        select: {
          id: true,
          name: true,
          email: true,
          nameModerationStatus: true,
        },
      })
    : [],
  ]);

  const orgMap = new Map(orgs.map((o) => [o.id, o] as const));
  const orgRevMap = new Map(orgReviews.map((r) => [r.id, r] as const));
  const spRevMap = new Map(spReviews.map((r) => [r.id, r] as const));
  const userMap = new Map(users.map((u) => [u.id, u] as const));

  return rows.map((row) =>
    ({
      ...row,
      organization:
        row.kind === ContentModerationCaseKind.organization_profile ?
          orgMap.get(row.subjectId) ?? null
        : null,
      organizationReview:
        row.kind === ContentModerationCaseKind.organization_review ?
          orgRevMap.get(row.subjectId) ?? null
        : null,
      specialistReview:
        row.kind === ContentModerationCaseKind.specialist_review ?
          spRevMap.get(row.subjectId) ?? null
        : null,
      targetUser:
        row.kind === ContentModerationCaseKind.user_display_name ?
          userMap.get(row.subjectId) ?? null
        : null,
    }) as typeof rows[number] & {
      organization: (typeof orgs)[number] | null;
      organizationReview: (typeof orgReviews)[number] | null;
      specialistReview: (typeof spReviews)[number] | null;
      targetUser: (typeof users)[number] | null;
    },
  );
}
