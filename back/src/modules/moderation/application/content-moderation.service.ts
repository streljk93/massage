import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContentModerationCaseKind,
  ContentModerationCaseStatus,
  GalleryOwnerKind,
  OrganizationProfileRevisionStatus,
  PublicationModerationStatus,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ImageNsfwModerationService } from './image-nsfw-moderation.service';
import { ModerationOllamaService } from './moderation-ollama.service';
import { hydrateContentModerationCaseRows } from './hydrate-content-moderation-cases';

const CONTENT_MOD_KIND_SPECIALIST_PROFILE =
  'specialist_profile' as ContentModerationCaseKind;

const specialistModerationProfileSelect = {
  listingName: true,
  bio: true,
  imageUrl: true,
  catalogListedBio: true,
  catalogListedListingName: true,
  catalogListedImageUrl: true,
} as const;

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
        data: {
          nameModerationStatus: PublicationModerationStatus.approved,
          catalogListedName: null,
        },
      });
      return;
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        nameModerationStatus: PublicationModerationStatus.pending_review,
      },
    });
    const openNameCase = await this.prisma.contentModerationCase.findFirst({
      where: {
        kind: ContentModerationCaseKind.user_display_name,
        subjectId: userId,
        status: ContentModerationCaseStatus.open,
      },
      select: { id: true },
    });
    if (openNameCase) {
      await this.prisma.contentModerationCase.update({
        where: { id: openNameCase.id },
        data: { aiSummary: rawSummary },
      });
      return;
    }
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
        data: {
          nameModerationStatus: PublicationModerationStatus.approved,
          catalogListedName: null,
        },
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
      data: {
        nameModerationStatus: PublicationModerationStatus.pending_review,
      },
    });
    const openNameCaseAfterPatch =
      await this.prisma.contentModerationCase.findFirst({
        where: {
          kind: ContentModerationCaseKind.user_display_name,
          subjectId: userId,
          status: ContentModerationCaseStatus.open,
        },
        select: { id: true },
      });
    if (openNameCaseAfterPatch) {
      await this.prisma.contentModerationCase.update({
        where: { id: openNameCaseAfterPatch.id },
        data: { aiSummary: rawSummary },
      });
      return;
    }
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
   * После создания салона: модерирует **снимок ревизии** (`subjectId` кейса = revision id).
   * Галерея — `IMAGE_MODERATION_BASE_URL`; тексты — Ollama.
   */
  async moderateOrganizationProfileRevision(revisionId: string): Promise<void> {
    const revision = await this.prisma.organizationProfileRevision.findFirst({
      where: { id: revisionId },
      select: {
        id: true,
        organizationId: true,
        status: true,
        name: true,
        description: true,
        phone: true,
        email: true,
        website: true,
      },
    });
    if (!revision) {
      return;
    }
    if (revision.status !== OrganizationProfileRevisionStatus.pending_review) {
      return;
    }
    const organizationId = revision.organizationId;

    const galleryItems = await this.prisma.galleryItem.findMany({
      where: {
        gallery: {
          ownerKind: GalleryOwnerKind.organization_profile_revision,
          ownerId: revisionId,
        },
      },
      orderBy: { sortOrder: 'asc' },
      take: 35,
      select: { url: true },
    });

    const textParts: { label: string; text: string }[] = [
      { label: 'name', text: revision.name },
      { label: 'description', text: revision.description ?? '' },
    ];
    const phone = revision.phone?.trim() ?? '';
    if (phone.length > 0) {
      textParts.push({ label: 'phone', text: phone });
    }
    const email = revision.email?.trim() ?? '';
    if (email.length > 0) {
      textParts.push({ label: 'email', text: email });
    }
    const website = revision.website?.trim() ?? '';
    if (website.length > 0) {
      textParts.push({ label: 'website', text: website });
    }

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

    const orgHead = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: {
        publicationModerationStatus: true,
        publishedProfileRevisionId: true,
      },
    });

    if (!needsManualReview) {
      await this.promoteOrganizationProfileRevision(revisionId);
      return;
    }

    const isFollowUpEdit =
      orgHead?.publishedProfileRevisionId != null &&
      orgHead.publishedProfileRevisionId !== revisionId;

    if (!isFollowUpEdit) {
      await this.prisma.organization.update({
        where: { id: organizationId },
        data: {
          publicationModerationStatus:
            PublicationModerationStatus.pending_review,
        },
      });
    }

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

    const summaryPayload = chunks.join('\n\n---\n\n').slice(0, 6500);
    const existingProfileCase =
      await this.prisma.contentModerationCase.findFirst({
        where: {
          kind: ContentModerationCaseKind.organization_profile,
          subjectId: revisionId,
          status: ContentModerationCaseStatus.open,
        },
        select: { id: true },
      });
    if (existingProfileCase != null) {
      await this.prisma.contentModerationCase.update({
        where: { id: existingProfileCase.id },
        data: { aiSummary: summaryPayload },
      });
    } else {
      await this.prisma.contentModerationCase.create({
        data: {
          kind: ContentModerationCaseKind.organization_profile,
          status: ContentModerationCaseStatus.open,
          subjectId: revisionId,
          aiSummary: summaryPayload,
        },
      });
    }
  }

  /** @deprecated Используйте `moderateOrganizationProfileRevision`; оставлено для старых job в очереди. */
  async moderateNewOrganizationProfile(organizationId: string): Promise<void> {
    const rev = await this.prisma.organizationProfileRevision.findFirst({
      where: {
        organizationId,
        status: OrganizationProfileRevisionStatus.pending_review,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (rev) {
      await this.moderateOrganizationProfileRevision(rev.id);
    }
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
          pendingCommentDraft: null,
          publishedComment: null,
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
            publishedComment: orgTxt,
            pendingCommentDraft: null,
          },
        });
      } else {
        await this.prisma.organizationReview.update({
          where: { id: args.organizationReviewId },
          data: {
            publicationModerationStatus:
              PublicationModerationStatus.pending_review,
            pendingCommentDraft: orgTxt,
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
          pendingCommentDraft: null,
          publishedComment: null,
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
            publishedComment: spTxt,
            pendingCommentDraft: null,
          },
        });
      } else {
        await this.prisma.specialistReview.update({
          where: { id: args.specialistReviewId },
          data: {
            publicationModerationStatus:
              PublicationModerationStatus.pending_review,
            pendingCommentDraft: spTxt,
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

  /**
   * Предмодерация профиля мастера в каталоге: имя на витрине (`listingName`), `bio`, фото (`imageUrl`).
   * Остальные поля профиля (опыт — выбор, alt и т.д.) не проверяем.
   * Кейсы: `subjectId` = `Specialist.id`. При правках после одобрения гости видят снимок в `catalogListed*`.
   */
  async moderateSpecialistProfile(specialistId: string): Promise<void> {
    const row = await this.prisma.specialist.findFirst({
      where: { id: specialistId, deletedAt: null },
      select: specialistModerationProfileSelect,
    });
    if (row == null) {
      return;
    }

    const nameTrim = (row.listingName ?? '').trim();
    const bioTrim = (row.bio ?? '').trim();
    const imageUrl = row.imageUrl;
    const hasImage = imageUrl != null && imageUrl.trim().length > 0;

    const textParts: { label: string; text: string }[] = [];
    if (nameTrim.length > 0) {
      textParts.push({
        label: 'specialist_listing_name',
        text: row.listingName ?? '',
      });
    }
    if (bioTrim.length > 0) {
      textParts.push({ label: 'specialist_bio', text: row.bio ?? '' });
    }

    const galleryProblems: string[] = [];
    if (hasImage) {
      if (!this.imageNsfw.isEnabled()) {
        galleryProblems.push(
          'Аватар мастера: задайте IMAGE_MODERATION_BASE_URL (+ MODERATION_FILE_FETCH_ORIGIN для относительных URL) или одобрите вручную.',
        );
      } else {
        const assessment = await this.imageNsfw.assessOrganizationGallery(
          [imageUrl.trim()],
          2,
        );
        if (
          assessment.kind === 'flagged_nsfw' ||
          assessment.kind === 'service_error'
        ) {
          galleryProblems.push(assessment.summary);
        }
      }
    }

    const textEval =
      textParts.length === 0
        ? ({
            verdict: 'pass',
            rawSummary: null,
            infraUnavailable: false,
          } as const)
        : await this.ollama.evaluateTexts(textParts);

    const needsManualReview =
      galleryProblems.length > 0 || textEval.verdict !== 'pass';

    if (!needsManualReview) {
      await this.prisma.specialist.update({
        where: { id: specialistId },
        data: {
          profilePublicationModerationStatus:
            PublicationModerationStatus.approved,
          catalogListedBio: null,
          catalogListedListingName: null,
          catalogListedImageUrl: null,
        },
      });
      await this.prisma.contentModerationCase.updateMany({
        where: {
          kind: CONTENT_MOD_KIND_SPECIALIST_PROFILE,
          subjectId: specialistId,
          status: ContentModerationCaseStatus.open,
        },
        data: {
          status: ContentModerationCaseStatus.resolved_approved,
          resolvedAt: new Date(),
          aiSummary:
            galleryProblems.length > 0
              ? galleryProblems.join('\n')
              : textEval.rawSummary,
        },
      });
      return;
    }

    const chunks: string[] = [];
    if (galleryProblems.length > 0) {
      chunks.push(
        galleryProblems.length === 1
          ? `Изображение: ${galleryProblems[0]}`
          : `Изображение:\n${galleryProblems.join('\n')}`,
      );
    }
    if (textEval.verdict !== 'pass') {
      chunks.push(
        `Текст (Ollama${textEval.infraUnavailable ? '; инфра Ollama' : ''}): ${
          textEval.rawSummary ?? ''
        }`,
      );
    }

    await this.prisma.specialist.update({
      where: { id: specialistId },
      data: {
        profilePublicationModerationStatus:
          PublicationModerationStatus.pending_review,
      },
    });

    const summaryPayload = chunks.join('\n\n---\n\n').slice(0, 6500);
    const existingCase = await this.prisma.contentModerationCase.findFirst({
      where: {
        kind: CONTENT_MOD_KIND_SPECIALIST_PROFILE,
        subjectId: specialistId,
        status: ContentModerationCaseStatus.open,
      },
      select: { id: true },
    });
    if (existingCase != null) {
      await this.prisma.contentModerationCase.update({
        where: { id: existingCase.id },
        data: {
          aiSummary: summaryPayload,
        },
      });
    } else {
      await this.prisma.contentModerationCase.create({
        data: {
          kind: CONTENT_MOD_KIND_SPECIALIST_PROFILE,
          status: ContentModerationCaseStatus.open,
          subjectId: specialistId,
          aiSummary: summaryPayload,
        },
      });
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
        await this.applyPromoteOrganizationProfileRevision(c.subjectId, tx);
      }
      if (c.kind === ContentModerationCaseKind.organization_review) {
        const row = await tx.organizationReview.findFirst({
          where: { id: c.subjectId },
          select: { pendingCommentDraft: true, organizationId: true },
        });
        const promoteText = row?.pendingCommentDraft?.trim() ?? '';
        await tx.organizationReview.update({
          where: { id: c.subjectId },
          data: {
            publicationModerationStatus: PublicationModerationStatus.approved,
            ...(promoteText.length > 0
              ? {
                  publishedComment: promoteText,
                  pendingCommentDraft: null,
                }
              : {}),
          },
        });
        if (row) {
          await this.refreshOrgReviewAggregates(tx, row.organizationId);
        }
      }
      if (c.kind === ContentModerationCaseKind.specialist_review) {
        const row = await tx.specialistReview.findFirst({
          where: { id: c.subjectId },
          select: { pendingCommentDraft: true, specialistId: true },
        });
        const promoteText = row?.pendingCommentDraft?.trim() ?? '';
        await tx.specialistReview.update({
          where: { id: c.subjectId },
          data: {
            publicationModerationStatus: PublicationModerationStatus.approved,
            ...(promoteText.length > 0
              ? {
                  publishedComment: promoteText,
                  pendingCommentDraft: null,
                }
              : {}),
          },
        });
        if (row) {
          await this.refreshSpecialistReviewAggregates(tx, row.specialistId);
        }
      }
      if (c.kind === CONTENT_MOD_KIND_SPECIALIST_PROFILE) {
        await tx.specialist.update({
          where: { id: c.subjectId },
          data: {
            profilePublicationModerationStatus:
              PublicationModerationStatus.approved,
            catalogListedBio: null,
            catalogListedListingName: null,
            catalogListedImageUrl: null,
          },
        });
      }
      if (c.kind === ContentModerationCaseKind.user_display_name) {
        await tx.user.update({
          where: { id: c.subjectId },
          data: {
            nameModerationStatus: PublicationModerationStatus.approved,
            catalogListedName: null,
          },
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
        const revision = await tx.organizationProfileRevision.findFirst({
          where: { id: c.subjectId },
          select: { organizationId: true },
        });
        if (revision) {
          const org = await tx.organization.findFirst({
            where: { id: revision.organizationId },
            select: { publishedProfileRevisionId: true },
          });
          const isFollowUp =
            org?.publishedProfileRevisionId != null &&
            org.publishedProfileRevisionId !== c.subjectId;
          if (isFollowUp) {
            await tx.organizationProfileRevision.update({
              where: { id: c.subjectId },
              data: {
                status: OrganizationProfileRevisionStatus.rejected,
              },
            });
          } else {
            await tx.organization.update({
              where: { id: revision.organizationId },
              data: {
                publicationModerationStatus:
                  PublicationModerationStatus.rejected,
              },
            });
            await tx.organizationProfileRevision.update({
              where: { id: c.subjectId },
              data: {
                status: OrganizationProfileRevisionStatus.rejected,
              },
            });
          }
        }
      }
      if (c.kind === ContentModerationCaseKind.organization_review) {
        await tx.organizationReview.update({
          where: { id: c.subjectId },
          data: {
            publicationModerationStatus: PublicationModerationStatus.rejected,
            pendingCommentDraft: null,
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
            pendingCommentDraft: null,
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
      if (c.kind === CONTENT_MOD_KIND_SPECIALIST_PROFILE) {
        await tx.specialist.update({
          where: { id: c.subjectId },
          data: {
            profilePublicationModerationStatus:
              PublicationModerationStatus.rejected,
          },
        });
      }
      if (c.kind === ContentModerationCaseKind.user_display_name) {
        await tx.user.update({
          where: { id: c.subjectId },
          data: { nameModerationStatus: PublicationModerationStatus.rejected },
        });
      }
    });
  }

  async promoteOrganizationProfileRevision(revisionId: string): Promise<void> {
    await this.prisma.$transaction((tx) =>
      this.applyPromoteOrganizationProfileRevision(revisionId, tx),
    );
  }

  private async applyPromoteOrganizationProfileRevision(
    revisionId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const rev = await tx.organizationProfileRevision.findFirst({
      where: { id: revisionId },
      include: {
        serviceCategories: { select: { serviceCategoryId: true } },
      },
    });
    if (!rev) {
      return;
    }
    const organizationId = rev.organizationId;

    const orgSnap = await tx.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { publishedProfileRevisionId: true },
    });
    const prevPublishedId = orgSnap?.publishedProfileRevisionId ?? null;
    if (prevPublishedId != null && prevPublishedId !== revisionId) {
      await tx.organizationProfileRevision.update({
        where: { id: prevPublishedId },
        data: { status: OrganizationProfileRevisionStatus.superseded },
      });
    }

    const localesBefore = await tx.organizationLocale.findMany({
      where: { organizationId },
      select: { locale: true },
    });
    await tx.organizationLocale.deleteMany({ where: { organizationId } });
    const localesToSeed =
      localesBefore.length > 0
        ? localesBefore.map((l) => l.locale)
        : [rev.catalogLocale];
    const uniqueLocales = [...new Set(localesToSeed)].filter(Boolean);
    for (const loc of uniqueLocales.length > 0
      ? uniqueLocales
      : [rev.catalogLocale]) {
      await tx.organizationLocale.create({
        data: {
          organizationId,
          locale: loc,
          name: rev.name,
          description: rev.description ?? null,
        },
      });
    }

    const revGal = await tx.gallery.findUnique({
      where: {
        ownerKind_ownerId: {
          ownerKind: GalleryOwnerKind.organization_profile_revision,
          ownerId: revisionId,
        },
      },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });

    let orgGal = await tx.gallery.findUnique({
      where: {
        ownerKind_ownerId: {
          ownerKind: GalleryOwnerKind.organization,
          ownerId: organizationId,
        },
      },
    });
    if (!orgGal) {
      orgGal = await tx.gallery.create({
        data: {
          ownerKind: GalleryOwnerKind.organization,
          ownerId: organizationId,
        },
      });
    }
    await tx.galleryItem.deleteMany({ where: { galleryId: orgGal.id } });
    if (revGal != null && revGal.items.length > 0) {
      let order = 0;
      for (const it of revGal.items) {
        await tx.galleryItem.create({
          data: {
            galleryId: orgGal.id,
            url: it.url,
            alt: it.alt,
            kind: it.kind,
            sortOrder: order,
          },
        });
        order += 1;
      }
    }

    await tx.organizationServiceCategory.deleteMany({
      where: { organizationId },
    });
    for (const row of rev.serviceCategories) {
      await tx.organizationServiceCategory.create({
        data: {
          organizationId,
          serviceCategoryId: row.serviceCategoryId,
        },
      });
    }

    const head = await tx.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { addressId: true },
    });
    if (
      rev.addressLine != null &&
      rev.latitude != null &&
      rev.longitude != null &&
      rev.addressSourceProvider != null &&
      rev.addressSourceProvider.trim().length > 0
    ) {
      const addrPayload = {
        addressLine: rev.addressLine,
        city: rev.city ?? null,
        latitude: rev.latitude,
        longitude: rev.longitude,
        sourceProvider: rev.addressSourceProvider,
        sourceReference: rev.addressSourceReference ?? null,
      };
      if (head?.addressId != null) {
        await tx.address.update({
          where: { id: head.addressId },
          data: addrPayload,
        });
      } else {
        const adr = await tx.address.create({ data: addrPayload });
        await tx.organization.update({
          where: { id: organizationId },
          data: { addressId: adr.id },
        });
      }
    }

    await tx.organization.update({
      where: { id: organizationId },
      data: {
        name: rev.name,
        description: rev.description ?? null,
        phone: rev.phone ?? null,
        email: rev.email ?? null,
        website: rev.website ?? null,
        yearsInBusiness: rev.yearsInBusiness ?? null,
        publicationModerationStatus: PublicationModerationStatus.approved,
        publishedProfileRevisionId: revisionId,
      },
    });

    await tx.organizationProfileRevision.update({
      where: { id: revisionId },
      data: { status: OrganizationProfileRevisionStatus.published },
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
