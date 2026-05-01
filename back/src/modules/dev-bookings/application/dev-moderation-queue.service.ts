import { Injectable } from '@nestjs/common';
import {
  ContentModerationCaseKind,
  ContentModerationCaseStatus,
  GalleryOwnerKind,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { hydrateContentModerationCaseRows } from '../../moderation/application/hydrate-content-moderation-cases';

const PUBLICATION_STATUS_DOCS = [
  {
    value: 'approved',
    label: 'Контент разрешён во витрине / отображается имя',
  },
  {
    value: 'pending_review',
    label: 'Ожидает ручной проверки или ещё не разрешён AI',
  },
  {
    value: 'rejected',
    label: 'Отклонён модератором; не показывается клиентам',
  },
] as const;

const CASE_KIND_DOCS = [
  {
    value: ContentModerationCaseKind.organization_profile,
    labelRu: 'Профиль салона (тексты, галерея требует ручного просмотра)',
  },
  {
    value: ContentModerationCaseKind.organization_review,
    labelRu: 'Комментарий к отзыву о салоне',
  },
  {
    value: ContentModerationCaseKind.specialist_review,
    labelRu: 'Комментарий к отзыву о специалисте',
  },
  {
    value: ContentModerationCaseKind.specialist_profile,
    labelRu: 'Профиль мастера во витрине (био, стаж аватар и alt)',
  },
  {
    value: ContentModerationCaseKind.user_display_name,
    labelRu: 'Отображаемое имя пользователя',
  },
] as const;

const CASE_STATUS_DOCS = [
  {
    value: ContentModerationCaseStatus.open,
    label: 'Открытый кейс — ждёт approve/reject',
  },
  {
    value: ContentModerationCaseStatus.resolved_approved,
    label: 'Модератор одобрил',
  },
  {
    value: ContentModerationCaseStatus.resolved_rejected,
    label: 'Модератор отклонил с причиной',
  },
] as const;

export type ModerationDevReferenceDto = {
  publicationModerationStatus: typeof PUBLICATION_STATUS_DOCS;
  contentModerationCaseKind: typeof CASE_KIND_DOCS;
  contentModerationCaseStatus: typeof CASE_STATUS_DOCS;
  resolution: {
    approve: {
      decision: 'approve';
      setsPublicationTo: 'approved';
      note: string;
    };
    reject: {
      decision: 'reject';
      setsPublicationTo: 'rejected';
      reasonRequired: true;
      note: string;
    };
  };
};

@Injectable()
export class DevModerationQueueService {
  constructor(private readonly prisma: PrismaService) {}

  getReference(): ModerationDevReferenceDto {
    return {
      publicationModerationStatus: [...PUBLICATION_STATUS_DOCS],
      contentModerationCaseKind: [...CASE_KIND_DOCS],
      contentModerationCaseStatus: [...CASE_STATUS_DOCS],
      resolution: {
        approve: {
          decision: 'approve',
          setsPublicationTo: 'approved',
          note: 'Публикует связанную сущность (салон / отзыв / имя) с PublicationModerationStatus = approved где применимо',
        },
        reject: {
          decision: 'reject',
          setsPublicationTo: 'rejected',
          reasonRequired: true,
          note: 'Отклоняет контент — требуются reason + PublicationModerationStatus = rejected',
        },
      },
    };
  }

  /** Открытые кейсы модерации + развёрнутое описание проблемного контента. */
  async getPendingQueueSnapshots() {
    const casesRaw = await this.prisma.contentModerationCase.findMany({
      where: { status: ContentModerationCaseStatus.open },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    const cases = await hydrateContentModerationCaseRows(this.prisma, casesRaw);

    const orgProfileRevisionIds = [
      ...new Set(
        cases
          .filter(
            (c) => c.kind === ContentModerationCaseKind.organization_profile,
          )
          .map((c) => c.subjectId),
      ),
    ];

    const revisionRows =
      orgProfileRevisionIds.length > 0
        ? await this.prisma.organizationProfileRevision.findMany({
            where: { id: { in: orgProfileRevisionIds } },
            select: {
              id: true,
              organizationId: true,
              status: true,
              name: true,
              description: true,
            },
          })
        : [];
    const revisionById = new Map(revisionRows.map((r) => [r.id, r] as const));

    const galleryItemCounts = await Promise.all(
      orgProfileRevisionIds.map(async (revisionId) => {
        const imageCount = await this.prisma.galleryItem.count({
          where: {
            gallery: {
              ownerKind: GalleryOwnerKind.organization_profile_revision,
              ownerId: revisionId,
            },
          },
        });
        return { revisionId, imageCount };
      }),
    );
    const galleryByRevision = new Map(
      galleryItemCounts.map((x) => [x.revisionId, x.imageCount] as const),
    );

    return cases.map((c) => ({
      caseId: c.id,
      kind: c.kind,
      kindHintRu:
        CASE_KIND_DOCS.find((k) => k.value === c.kind)?.labelRu ?? c.kind,
      status: c.status,
      aiSummary: c.aiSummary,
      createdAt: c.createdAt.toISOString(),
      content:
        c.kind === ContentModerationCaseKind.organization_profile &&
        c.organization != null
          ? {
              type: 'organization_profile' as const,
              profileRevisionId: c.subjectId,
              organizationId: c.organization.id,
              revisionStatus: revisionById.get(c.subjectId)?.status ?? null,
              revisionName: revisionById.get(c.subjectId)?.name ?? null,
              revisionDescription:
                revisionById.get(c.subjectId)?.description ?? null,
              publicationModerationStatus:
                c.organization.publicationModerationStatus ?? null,
              liveName: c.organization.name ?? null,
              liveDescription: c.organization.description ?? null,
              slug: c.organization.slug ?? null,
              locales: [],
              revisionGalleryImageCount:
                galleryByRevision.get(c.subjectId) ?? 0,
            }
          : c.kind === ContentModerationCaseKind.organization_review &&
              c.organizationReview
            ? {
                type: 'organization_review' as const,
                reviewId: c.organizationReview.id,
                organizationId: c.organizationReview.organizationId,
                rating: c.organizationReview.rating,
                comment:
                  c.organizationReview.pendingCommentDraft ??
                  c.organizationReview.publishedComment,
                publishedComment: c.organizationReview.publishedComment,
                pendingCommentDraft: c.organizationReview.pendingCommentDraft,
                publicationModerationStatus:
                  c.organizationReview.publicationModerationStatus,
              }
            : c.kind === ContentModerationCaseKind.specialist_review &&
                c.specialistReview
              ? {
                  type: 'specialist_review' as const,
                  reviewId: c.specialistReview.id,
                  specialistId: c.specialistReview.specialistId,
                  rating: c.specialistReview.rating,
                  comment:
                    c.specialistReview.pendingCommentDraft ??
                    c.specialistReview.publishedComment,
                  publishedComment: c.specialistReview.publishedComment,
                  pendingCommentDraft: c.specialistReview.pendingCommentDraft,
                  publicationModerationStatus:
                    c.specialistReview.publicationModerationStatus,
                }
              : c.kind === ContentModerationCaseKind.specialist_profile &&
                  c.specialistListedProfile
                ? {
                    type: 'specialist_profile' as const,
                    specialistId: c.specialistListedProfile.id,
                    userId: c.specialistListedProfile.userId,
                    listingName: c.specialistListedProfile.listingName,
                    bio: c.specialistListedProfile.bio,
                    experienceYears: c.specialistListedProfile.experienceYears,
                    imageUrl: c.specialistListedProfile.imageUrl,
                    imageAlt: c.specialistListedProfile.imageAlt,
                    profilePublicationModerationStatus:
                      c.specialistListedProfile
                        .profilePublicationModerationStatus,
                  }
                : c.kind === ContentModerationCaseKind.user_display_name &&
                    c.targetUser
                  ? {
                      type: 'user_display_name' as const,
                      userId: c.targetUser.id,
                      email: c.targetUser.email,
                      displayName: c.targetUser.name,
                      nameModerationStatus: c.targetUser.nameModerationStatus,
                    }
                  : { type: 'unknown' as const, note: 'связи не загружены' },
    }));
  }
}
