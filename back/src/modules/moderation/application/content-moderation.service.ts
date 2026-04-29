import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContentModerationCaseKind,
  ContentModerationCaseStatus,
  GalleryOwnerKind,
  PublicationModerationStatus,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ImageNsfwModerationService } from './image-nsfw-moderation.service';
import { ModerationOllamaService } from './moderation-ollama.service';
import { hydrateContentModerationCaseRows } from './hydrate-content-moderation-cases';

@Injectable()
export class ContentModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ollama: ModerationOllamaService,
    private readonly imageNsfw: ImageNsfwModerationService,
  ) {}

  /** Новый аккаунт / OAuth: модерация отображаемого имени (не блокирует выдачу токена). */
  async moderateDisplayNameInitial(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { name: true },
    });
    if (!user) {
      return;
    }
    const { verdict, rawSummary } = await this.ollama.evaluateTexts([
      { label: 'display_name', text: user.name },
    ]);
    if (verdict === 'pass') {
      await this.prisma.user.update({
        where: { id: userId },
        data: { nameModerationStatus: PublicationModerationStatus.approved },
      });
      return;
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { nameModerationStatus: PublicationModerationStatus.pending_review },
    });
    await this.prisma.contentModerationCase.create({
      data: {
        kind: ContentModerationCaseKind.user_display_name,
        status: ContentModerationCaseStatus.open,
        subjectId: userId,
        aiSummary: rawSummary,
      },
    });
  }

  /** Смена имени в PATCH /users/me */
  async moderateDisplayNameAfterPatch(
    userId: string,
    newName: string,
  ): Promise<void> {
    const { verdict, rawSummary } = await this.ollama.evaluateTexts([
      { label: 'display_name', text: newName },
    ]);
    if (verdict === 'pass') {
      await this.prisma.user.update({
        where: { id: userId },
        data: { nameModerationStatus: PublicationModerationStatus.approved },
      });
      await this.prisma.contentModerationCase.updateMany({
        where: {
          subjectId: userId,
          kind: ContentModerationCaseKind.user_display_name,
          status: ContentModerationCaseStatus.open,
        },
        data: {
          status: ContentModerationCaseStatus.resolved_approved,
          resolvedAt: new Date(),
          aiSummary: rawSummary,
        },
      });
      return;
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { nameModerationStatus: PublicationModerationStatus.pending_review },
    });
    await this.prisma.contentModerationCase.create({
      data: {
        kind: ContentModerationCaseKind.user_display_name,
        status: ContentModerationCaseStatus.open,
        subjectId: userId,
        aiSummary: rawSummary,
      },
    });
  }

  /**
   * После создания салона.
   * Галерея — `IMAGE_MODERATION_BASE_URL`; тексты — Ollama. Оба шага выполняются последовательно; при ручной проверке в кейсе одна сводка по фото и тексту.
   */
  async moderateNewOrganizationProfile(organizationId: string): Promise<void> {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: {
        name: true,
        description: true,
        locales: {
          select: { locale: true, name: true, description: true },
        },
      },
    });
    if (!org) {
      return;
    }

    const galleryItems = await this.prisma.galleryItem.findMany({
      where: {
        gallery: {
          ownerKind: GalleryOwnerKind.organization,
          ownerId: organizationId,
        },
      },
      orderBy: { sortOrder: 'asc' },
      take: 35,
      select: { url: true },
    });

    const textParts = [
      { label: 'name', text: org.name },
      { label: 'description', text: org.description ?? '' },
      ...org.locales.flatMap((l) => [
        {
          label: `name_${l.locale}`,
          text: l.name,
        },
        {
          label: `description_${l.locale}`,
          text: l.description ?? '',
        },
      ]),
    ];

    const galleryProblems: string[] = [];

    if (galleryItems.length > 0) {
      if (!this.imageNsfw.isEnabled()) {
        galleryProblems.push(
          `Gallery contains ${galleryItems.length} image(s); ` +
            `configure IMAGE_MODERATION_BASE_URL (+ MODERATION_FILE_FETCH_ORIGIN for /v1/files/...) for automatic NSFW scanning, or approve manually.`,
        );
      } else {
        const assessment = await this.imageNsfw.assessOrganizationGallery(
          galleryItems.map((x) => x.url),
        );
        if (
          assessment.kind === 'flagged_nsfw' ||
          assessment.kind === 'service_error'
        ) {
          galleryProblems.push(assessment.summary);
        }
      }
    }

    const textEval = await this.ollama.evaluateTexts(textParts);

    const needsManualReview =
      galleryProblems.length > 0 || textEval.verdict !== 'pass';

    if (!needsManualReview) {
      await this.prisma.organization.update({
        where: { id: organizationId },
        data: {
          publicationModerationStatus: PublicationModerationStatus.approved,
        },
      });
      return;
    }

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        publicationModerationStatus: PublicationModerationStatus.pending_review,
      },
    });

    const chunks: string[] = [];
    if (galleryProblems.length > 0) {
      chunks.push(
        galleryProblems.length === 1
          ? `Изображения: ${galleryProblems[0]}`
          : `Изображения:\n${galleryProblems.join('\n')}`,
      );
    }
    if (textEval.verdict !== 'pass') {
      chunks.push(
        `Текст (Ollama${textEval.infraUnavailable ? '; инфра Ollama' : ''}): ${
          textEval.rawSummary ?? ''
        }`,
      );
    }

    await this.prisma.contentModerationCase.create({
      data: {
        kind: ContentModerationCaseKind.organization_profile,
        status: ContentModerationCaseStatus.open,
        subjectId: organizationId,
        aiSummary: chunks.join('\n\n---\n\n').slice(0, 6500),
      },
    });
  }

  /** Отзывы по завершённому визиту (после коммита транзакции создания записей отзыва). */
  async moderateVisitReviewPair(args: {
    organizationReviewId: string;
    specialistReviewId: string;
    organizationComment: string | null;
    specialistComment: string | null;
  }): Promise<void> {
    const orgTxt = args.organizationComment?.trim() ?? '';
    const spTxt = args.specialistComment?.trim() ?? '';

    if (orgTxt === '') {
      await this.prisma.organizationReview.update({
        where: { id: args.organizationReviewId },
        data: {
          publicationModerationStatus: PublicationModerationStatus.approved,
        },
      });
    } else {
      const { verdict, rawSummary } = await this.ollama.evaluateTexts([
        {
          label: 'organization_visit_comment',
          text: orgTxt,
        },
      ]);
      if (verdict === 'pass') {
        await this.prisma.organizationReview.update({
          where: { id: args.organizationReviewId },
          data: {
            publicationModerationStatus: PublicationModerationStatus.approved,
          },
        });
      } else {
        await this.prisma.organizationReview.update({
          where: { id: args.organizationReviewId },
          data: {
            publicationModerationStatus:
              PublicationModerationStatus.pending_review,
          },
        });
        await this.prisma.contentModerationCase.create({
          data: {
            kind: ContentModerationCaseKind.organization_review,
            status: ContentModerationCaseStatus.open,
            subjectId: args.organizationReviewId,
            aiSummary: rawSummary,
          },
        });
      }
    }

    if (spTxt === '') {
      await this.prisma.specialistReview.update({
        where: { id: args.specialistReviewId },
        data: {
          publicationModerationStatus: PublicationModerationStatus.approved,
        },
      });
    } else {
      const { verdict, rawSummary } = await this.ollama.evaluateTexts([
        { label: 'specialist_visit_comment', text: spTxt },
      ]);
      if (verdict === 'pass') {
        await this.prisma.specialistReview.update({
          where: { id: args.specialistReviewId },
          data: {
            publicationModerationStatus: PublicationModerationStatus.approved,
          },
        });
      } else {
        await this.prisma.specialistReview.update({
          where: { id: args.specialistReviewId },
          data: {
            publicationModerationStatus:
              PublicationModerationStatus.pending_review,
          },
        });
        await this.prisma.contentModerationCase.create({
          data: {
            kind: ContentModerationCaseKind.specialist_review,
            status: ContentModerationCaseStatus.open,
            subjectId: args.specialistReviewId,
            aiSummary: rawSummary,
          },
        });
      }
    }
  }

  async listOpenCases(take: number) {
    const rows = await this.prisma.contentModerationCase.findMany({
      where: { status: ContentModerationCaseStatus.open },
      orderBy: { createdAt: 'asc' },
      take,
    });
    return hydrateContentModerationCaseRows(this.prisma, rows);
  }

  async resolveCaseApprove(caseId: string, moderatorUserId: string | null) {
    const c = await this.prisma.contentModerationCase.findFirst({
      where: { id: caseId },
    });
    if (!c) {
      throw new NotFoundException({
        code: 'MODERATION_CASE_NOT_FOUND',
        message: 'Case not found',
      });
    }
    if (c.status !== ContentModerationCaseStatus.open) {
      throw new BadRequestException({
        code: 'MODERATION_CASE_NOT_OPEN',
        message: 'Case is not open',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.contentModerationCase.update({
        where: { id: caseId },
        data: {
          status: ContentModerationCaseStatus.resolved_approved,
          moderatorUserId,
          resolvedAt: new Date(),
        },
      });

      if (c.kind === ContentModerationCaseKind.organization_profile) {
        await tx.organization.update({
          where: { id: c.subjectId },
          data: {
            publicationModerationStatus: PublicationModerationStatus.approved,
          },
        });
      }
      if (c.kind === ContentModerationCaseKind.organization_review) {
        await tx.organizationReview.update({
          where: { id: c.subjectId },
          data: {
            publicationModerationStatus: PublicationModerationStatus.approved,
          },
        });
        const rev = await tx.organizationReview.findFirst({
          where: { id: c.subjectId },
          select: { organizationId: true },
        });
        if (rev) {
          await this.refreshOrgReviewAggregates(tx, rev.organizationId);
        }
      }
      if (c.kind === ContentModerationCaseKind.specialist_review) {
        await tx.specialistReview.update({
          where: { id: c.subjectId },
          data: {
            publicationModerationStatus: PublicationModerationStatus.approved,
          },
        });
        const rev = await tx.specialistReview.findFirst({
          where: { id: c.subjectId },
          select: { specialistId: true },
        });
        if (rev) {
          await this.refreshSpecialistReviewAggregates(tx, rev.specialistId);
        }
      }
      if (c.kind === ContentModerationCaseKind.user_display_name) {
        await tx.user.update({
          where: { id: c.subjectId },
          data: { nameModerationStatus: PublicationModerationStatus.approved },
        });
      }
    });
  }

  async resolveCaseReject(
    caseId: string,
    moderatorUserId: string | null,
    reason: string,
  ) {
    const trimmed = reason.trim();
    if (trimmed.length === 0) {
      throw new BadRequestException({
        code: 'MODERATOR_REASON_REQUIRED',
        message: 'Moderator reason is required',
      });
    }
    const c = await this.prisma.contentModerationCase.findFirst({
      where: { id: caseId },
    });
    if (!c) {
      throw new NotFoundException({
        code: 'MODERATION_CASE_NOT_FOUND',
        message: 'Case not found',
      });
    }
    if (c.status !== ContentModerationCaseStatus.open) {
      throw new BadRequestException({
        code: 'MODERATION_CASE_NOT_OPEN',
        message: 'Case is not open',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.contentModerationCase.update({
        where: { id: caseId },
        data: {
          status: ContentModerationCaseStatus.resolved_rejected,
          moderatorUserId,
          moderatorReason: trimmed,
          resolvedAt: new Date(),
        },
      });

      if (c.kind === ContentModerationCaseKind.organization_profile) {
        await tx.organization.update({
          where: { id: c.subjectId },
          data: {
            publicationModerationStatus: PublicationModerationStatus.rejected,
          },
        });
      }
      if (c.kind === ContentModerationCaseKind.organization_review) {
        await tx.organizationReview.update({
          where: { id: c.subjectId },
          data: {
            publicationModerationStatus: PublicationModerationStatus.rejected,
          },
        });
        const rev = await tx.organizationReview.findFirst({
          where: { id: c.subjectId },
          select: { organizationId: true },
        });
        if (rev) {
          await this.refreshOrgReviewAggregates(tx, rev.organizationId);
        }
      }
      if (c.kind === ContentModerationCaseKind.specialist_review) {
        await tx.specialistReview.update({
          where: { id: c.subjectId },
          data: {
            publicationModerationStatus: PublicationModerationStatus.rejected,
          },
        });
        const rev = await tx.specialistReview.findFirst({
          where: { id: c.subjectId },
          select: { specialistId: true },
        });
        if (rev) {
          await this.refreshSpecialistReviewAggregates(tx, rev.specialistId);
        }
      }
      if (c.kind === ContentModerationCaseKind.user_display_name) {
        await tx.user.update({
          where: { id: c.subjectId },
          data: { nameModerationStatus: PublicationModerationStatus.rejected },
        });
      }
    });
  }

  private async refreshOrgReviewAggregates(
    tx: Prisma.TransactionClient,
    organizationId: string,
  ) {
    const agg = await tx.organizationReview.aggregate({
      where: {
        organizationId,
        deletedAt: null,
        publicationModerationStatus: PublicationModerationStatus.approved,
      },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const count = agg._count._all;
    const avg = agg._avg.rating;
    await tx.organization.update({
      where: { id: organizationId },
      data: {
        reviewsCount: count,
        ratingAverage: count === 0 ? 0 : Number(avg ?? 0),
      },
    });
  }

  private async refreshSpecialistReviewAggregates(
    tx: Prisma.TransactionClient,
    specialistId: string,
  ) {
    const agg = await tx.specialistReview.aggregate({
      where: {
        specialistId,
        deletedAt: null,
        publicationModerationStatus: PublicationModerationStatus.approved,
      },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const count = agg._count._all;
    const avg = agg._avg.rating;
    await tx.specialist.update({
      where: { id: specialistId },
      data: {
        reviewsCount: count,
        ratingAverage: count === 0 ? 0 : Number(avg ?? 0),
      },
    });
  }
}
