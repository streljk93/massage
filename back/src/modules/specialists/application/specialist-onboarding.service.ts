import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ApiLocale } from '../../../common/i18n';
import {
  pickLocalizedServiceCategoryFields,
  type CategoryLocaleShape,
} from '../../../common/i18n/locale-table.resolver';
import {
  ContentModerationCaseKind,
  ContentModerationCaseStatus,
  PublicationModerationStatus,
  SpecialistProfileRevisionStatus,
  SpecialistWorkplaceJoinRequestStatus,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ModerationEnqueueService } from '../../moderation/application/moderation-enqueue.service';
import { computeListedInDirectory } from '../domain/specialist-directory-flags';
import type { PatchSpecialistProfileBody } from '../dto/specialist-body.schema';

type OnboardingStep = 1 | 3 | 4 | 5 | 6;

type CabinetVitrine = {
  listingName: string | null;
  bio: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
};

@Injectable()
export class SpecialistOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderationEnqueue: ModerationEnqueueService,
  ) {}

  /** Черновик на модерации имеет приоритет над опубликованными колонками `Specialist` в кабинете. */
  private async getCabinetVitrineSnapshot(
    specialistId: string,
    published: CabinetVitrine,
  ): Promise<CabinetVitrine> {
    const pending = await this.prisma.specialistProfileRevision.findFirst({
      where: {
        specialistId,
        status: SpecialistProfileRevisionStatus.pending_review,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        listingName: true,
        bio: true,
        imageUrl: true,
        imageAlt: true,
      },
    });
    if (pending != null) {
      return {
        listingName: pending.listingName,
        bio: pending.bio,
        imageUrl: pending.imageUrl,
        imageAlt: pending.imageAlt,
      };
    }
    return published;
  }

  private isProfileComplete(
    user: { phone: string | null },
    vitrine: CabinetVitrine,
    spec: { experienceYears: number | null },
  ): boolean {
    if (!vitrine.listingName?.trim() || !user.phone?.trim()) {
      return false;
    }
    if (!vitrine.bio?.trim() || spec.experienceYears == null) {
      return false;
    }
    return true;
  }

  private async countPersonalServices(specialistId: string): Promise<number> {
    return this.prisma.service.count({
      where: {
        specialistId,
        organizationId: null,
        deletedAt: null,
      },
    });
  }

  private async resolveStep(
    userId: string,
  ): Promise<{ step: OnboardingStep; specialistId: string | null }> {
    const spec = await this.prisma.specialist.findFirst({
      where: { userId, deletedAt: null },
    });
    if (!spec) {
      return { step: 1, specialistId: null };
    }
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { phone: true },
    });
    if (!user) {
      return { step: 1, specialistId: null };
    }
    const vitrine = await this.getCabinetVitrineSnapshot(spec.id, {
      listingName: spec.listingName,
      bio: spec.bio,
      imageUrl: spec.imageUrl,
      imageAlt: spec.imageAlt,
    });
    if (!this.isProfileComplete(user, vitrine, spec)) {
      return { step: 1, specialistId: spec.id };
    }
    const svcCount = await this.countPersonalServices(spec.id);
    if (svcCount < 1) {
      return { step: 3, specialistId: spec.id };
    }
    if (!spec.onboardingCompletedAt) {
      if (spec.activeOrganizationId) {
        return { step: 5, specialistId: spec.id };
      }
      const pendingJoin =
        await this.prisma.specialistWorkplaceJoinRequest.findFirst({
          where: {
            specialistId: spec.id,
            status: SpecialistWorkplaceJoinRequestStatus.pending,
          },
          orderBy: { updatedAt: 'desc' },
        });
      if (pendingJoin) {
        return { step: 5, specialistId: spec.id };
      }
      return { step: 4, specialistId: spec.id };
    }
    return { step: 6, specialistId: spec.id };
  }

  /**
   * Снимок полей специалиста для кабинета (как объект `specialist` в онбординге).
   * Используется и самим мастером, и владельцем салона при просмотре заявителя.
   */
  private async buildSpecialistCabinetPayload(
    specialistId: string,
    locale: ApiLocale,
  ): Promise<Record<string, unknown> | null> {
    const spec = await this.prisma.specialist.findFirst({
      where: { id: specialistId, deletedAt: null },
      include: { massageProfile: true },
    });
    if (!spec) {
      return null;
    }
    const userRow = await this.prisma.user.findFirst({
      where: { id: spec.userId, deletedAt: null },
      select: { name: true, phone: true, email: true, avatarUrl: true },
    });
    if (!userRow) {
      return null;
    }
    const vitrine = await this.getCabinetVitrineSnapshot(spec.id, {
      listingName: spec.listingName,
      bio: spec.bio,
      imageUrl: spec.imageUrl,
      imageAlt: spec.imageAlt,
    });
    const pendingJoin =
      await this.prisma.specialistWorkplaceJoinRequest.findFirst({
        where: {
          specialistId: spec.id,
          status: SpecialistWorkplaceJoinRequestStatus.pending,
        },
        include: {
          organization: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });

    const personalServiceRows = await this.prisma.service.findMany({
      where: {
        specialistId: spec.id,
        organizationId: null,
        deletedAt: null,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        category: {
          include: {
            locales: {
              select: {
                locale: true,
                name: true,
                shortName: true,
                description: true,
              },
            },
          },
        },
        priceOptions: {
          orderBy: { durationMinutes: 'asc' },
          select: {
            durationMinutes: true,
            priceAmount: true,
            currency: true,
          },
        },
      },
    });

    const personalServices = personalServiceRows.map((row) => ({
      id: row.id,
      categoryId: row.categoryId,
      categoryName: pickLocalizedServiceCategoryFields(
        row.category as CategoryLocaleShape,
        locale,
      ).name,
      description: row.description,
      priceOptions: row.priceOptions.map((o) => ({
        durationMinutes: o.durationMinutes,
        priceAmount: o.priceAmount,
        currency: o.currency,
      })),
    }));

    /** Пока висит черновик ревизии — в кабинете показываем «на модерации», как у салона с pending revision. */
    const pendingProfileRevision = await this.prisma.specialistProfileRevision.findFirst({
      where: {
        specialistId: spec.id,
        status: SpecialistProfileRevisionStatus.pending_review,
      },
      select: { id: true },
    });
    const profilePublicationModerationStatusForCabinet =
      pendingProfileRevision != null
        ? PublicationModerationStatus.pending_review
        : spec.profilePublicationModerationStatus;

    return {
      id: spec.id,
      userId: spec.userId,
      bio: vitrine.bio,
      experienceYears: spec.experienceYears,
      listingName: vitrine.listingName,
      imageUrl: vitrine.imageUrl,
      imageAlt: vitrine.imageAlt,
      profilePublicationModerationStatus:
        profilePublicationModerationStatusForCabinet,
      massage: spec.massageProfile
        ? {
            pressureLevel: spec.massageProfile.pressureLevel,
            pressureAdaptsToClient: spec.massageProfile.pressureAdaptsToClient,
          }
        : null,
      activeOrganizationId: spec.activeOrganizationId,
      onboardingCompletedAt: spec.onboardingCompletedAt,
      userName: userRow.name,
      userPhone: userRow.phone,
      userEmail: userRow.email,
      userAvatarUrl: userRow.avatarUrl,
      pendingWorkplaceJoinRequest: pendingJoin
        ? {
            id: pendingJoin.id,
            organizationId: pendingJoin.organizationId,
            organizationName: pendingJoin.organization.name,
          }
        : null,
      personalServices,
    };
  }

  private async mapOnboarding(
    userId: string,
    locale: ApiLocale,
  ): Promise<{
    onboardingStep: OnboardingStep;
    specialist: Record<string, unknown> | null;
  }> {
    const { step, specialistId } = await this.resolveStep(userId);
    if (!specialistId) {
      return { onboardingStep: step, specialist: null };
    }
    const specialist = await this.buildSpecialistCabinetPayload(
      specialistId,
      locale,
    );
    if (!specialist) {
      return { onboardingStep: 1, specialist: null };
    }
    return { onboardingStep: step, specialist };
  }

  /** Для API салона: карточка заявителя без проверки онбординг-шага. */
  async buildSpecialistCabinetSnapshotForSpecialistId(
    specialistId: string,
    locale: ApiLocale = 'en',
  ): Promise<Record<string, unknown> | null> {
    return this.buildSpecialistCabinetPayload(specialistId, locale);
  }

  async getOnboarding(userId: string, locale: ApiLocale = 'en') {
    return this.mapOnboarding(userId, locale);
  }

  async ensureSpecialist(userId: string): Promise<void> {
    const exists = await this.prisma.specialist.findFirst({
      where: { userId, deletedAt: null },
    });
    if (exists) {
      return;
    }
    await this.prisma.specialist.create({
      data: { userId },
    });
  }

  async patchProfile(userId: string, body: PatchSpecialistProfileBody) {
    const spec = await this.prisma.specialist.findFirst({
      where: { userId, deletedAt: null },
    });
    if (!spec) {
      throw new NotFoundException({
        code: 'SPECIALIST_PROFILE_NOT_FOUND',
        message: 'Specialist profile not found for this user',
      });
    }

    const touchesVitrineFields =
      body.name !== undefined ||
      body.bio !== undefined ||
      body.imageUrl !== undefined;

    const pendingDraft = await this.prisma.specialistProfileRevision.findFirst({
      where: {
        specialistId: spec.id,
        status: SpecialistProfileRevisionStatus.pending_review,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        listingName: true,
        bio: true,
        imageUrl: true,
        imageAlt: true,
      },
    });

    const baseListingName = pendingDraft?.listingName ?? spec.listingName;
    const baseBio = pendingDraft?.bio ?? spec.bio;
    const baseImageUrl = pendingDraft?.imageUrl ?? spec.imageUrl;
    const baseImageAlt = pendingDraft?.imageAlt ?? spec.imageAlt;

    let mergedListingName = baseListingName;
    let mergedBio = baseBio;
    let mergedImageUrl = baseImageUrl;
    let mergedImageAlt = baseImageAlt;

    if (body.name !== undefined) {
      mergedListingName = body.name;
    }
    if (body.bio !== undefined) {
      mergedBio = body.bio;
    }
    if (body.imageUrl !== undefined) {
      mergedImageUrl = body.imageUrl;
    }
    if (body.imageAlt !== undefined) {
      mergedImageAlt = body.imageAlt;
    }

    let newRevisionId: string | null = null;

    await this.prisma.$transaction(async (tx) => {
      if (body.phone !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: { phone: body.phone },
        });
      }

      if (touchesVitrineFields) {
        const staleRevisionIds = (
          await tx.specialistProfileRevision.findMany({
            where: {
              specialistId: spec.id,
              status: SpecialistProfileRevisionStatus.pending_review,
            },
            select: { id: true },
          })
        ).map((r) => r.id);
        if (staleRevisionIds.length > 0) {
          await tx.specialistProfileRevision.updateMany({
            where: { id: { in: staleRevisionIds } },
            data: { status: SpecialistProfileRevisionStatus.superseded },
          });
          await tx.contentModerationCase.updateMany({
            where: {
              kind: ContentModerationCaseKind.specialist_profile,
              subjectId: { in: staleRevisionIds },
              status: ContentModerationCaseStatus.open,
            },
            data: {
              status: ContentModerationCaseStatus.resolved_rejected,
              moderatorReason: 'Superseded by a newer submission',
              resolvedAt: new Date(),
            },
          });
        }

        const revision = await tx.specialistProfileRevision.create({
          data: {
            specialistId: spec.id,
            status: SpecialistProfileRevisionStatus.pending_review,
            listingName: mergedListingName,
            bio: mergedBio,
            imageUrl: mergedImageUrl,
            imageAlt: mergedImageAlt,
          },
        });
        newRevisionId = revision.id;
      } else if (body.imageAlt !== undefined) {
        await tx.specialist.update({
          where: { id: spec.id },
          data: { imageAlt: body.imageAlt },
        });
      }

      const specData: {
        experienceYears?: number;
      } = {};
      if (body.experienceYears !== undefined) {
        specData.experienceYears = body.experienceYears;
      }
      if (Object.keys(specData).length > 0) {
        await tx.specialist.update({
          where: { id: spec.id },
          data: specData,
        });
      }

      if (body.massage !== undefined) {
        const m = body.massage;
        if (
          m.pressureLevel !== undefined ||
          m.pressureAdaptsToClient !== undefined
        ) {
          const update: {
            pressureLevel?: number;
            pressureAdaptsToClient?: boolean;
          } = {};
          if (m.pressureLevel !== undefined) {
            update.pressureLevel = m.pressureLevel;
          }
          if (m.pressureAdaptsToClient !== undefined) {
            update.pressureAdaptsToClient = m.pressureAdaptsToClient;
          }
          await tx.specialistMassageProfile.upsert({
            where: { specialistId: spec.id },
            create: {
              specialistId: spec.id,
              ...update,
            },
            update,
          });
        }
      }
    });

    if (newRevisionId != null) {
      await this.moderationEnqueue.enqueueSpecialistProfileModeration(
        newRevisionId,
      );
    }

    return this.mapOnboarding(userId, 'en');
  }

  async completeOnboarding(userId: string) {
    const { step, specialistId } = await this.resolveStep(userId);
    if (!specialistId) {
      throw new NotFoundException({
        code: 'SPECIALIST_PROFILE_NOT_FOUND',
        message: 'Specialist profile not found for this user',
      });
    }
    if (step !== 5) {
      throw new ConflictException({
        code: 'ONBOARDING_NOT_READY',
        message: 'Complete previous onboarding steps first',
      });
    }
    const spec = await this.prisma.specialist.findFirst({
      where: { id: specialistId, deletedAt: null },
    });
    if (!spec) {
      throw new NotFoundException({
        code: 'SPECIALIST_PROFILE_NOT_FOUND',
        message: 'Specialist profile not found for this user',
      });
    }
    const now = new Date();
    await this.prisma.specialist.update({
      where: { id: spec.id },
      data: {
        onboardingCompletedAt: now,
        listedInDirectory: computeListedInDirectory({
          onboardingCompletedAt: now,
          activeOrganizationId: spec.activeOrganizationId,
        }),
      },
    });
    return this.mapOnboarding(userId, 'en');
  }
}
