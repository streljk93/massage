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
  { value: 'rejected', label: 'Отклонён модератором; не показывается клиентам' },
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
          note:
            'Публикует связанную сущность (салон / отзыв / имя) с PublicationModerationStatus = approved где применимо',
        },
        reject: {
          decision: 'reject',
          setsPublicationTo: 'rejected',
          reasonRequired: true,
          note:
            'Отклоняет контент — требуются reason + PublicationModerationStatus = rejected',
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

    const orgProfileIds = [
      ...new Set(
        cases
          .filter(
            (c) =>
              c.kind === ContentModerationCaseKind.organization_profile,
          )
          .map((c) => c.subjectId),
      ),
    ];

    const localesByOrgId =
      orgProfileIds.length > 0
        ? await this.prisma.organizationLocale.findMany({
            where: { organizationId: { in: orgProfileIds } },
            select: {
              organizationId: true,
              locale: true,
              name: true,
              description: true,
            },
          })
        : [];

    const locMap = new Map<string, typeof localesByOrgId>();
    for (const row of localesByOrgId) {
      let arr = locMap.get(row.organizationId);
      if (arr == null) {
        arr = [];
        locMap.set(row.organizationId, arr);
      }
      arr.push(row);
    }

    const galleryItemCounts = await Promise.all(
      orgProfileIds.map(async (oid) => {
        const imageCount = await this.prisma.galleryItem.count({
          where: {
            gallery: {
              ownerKind: GalleryOwnerKind.organization,
              ownerId: oid,
            },
          },
        });
        return { organizationId: oid, imageCount };
      }),
    );
    const galleryByOrg = new Map(
      galleryItemCounts.map((x) => [x.organizationId, x.imageCount] as const),
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
              organizationId: c.subjectId,
              publicationModerationStatus:
                c.organization.publicationModerationStatus ?? null,
              name: c.organization.name ?? null,
              description: c.organization.description ?? null,
              slug: c.organization.slug ?? null,
              locales: locMap.get(c.subjectId) ?? [],
              galleryImageCount: galleryByOrg.get(c.subjectId) ?? 0,
            }
          : c.kind === ContentModerationCaseKind.organization_review &&
              c.organizationReview
            ? {
                type: 'organization_review' as const,
                reviewId: c.organizationReview.id,
                organizationId: c.organizationReview.organizationId,
                rating: c.organizationReview.rating,
                comment: c.organizationReview.comment,
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
                  comment: c.specialistReview.comment,
                  publicationModerationStatus:
                    c.specialistReview.publicationModerationStatus,
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
