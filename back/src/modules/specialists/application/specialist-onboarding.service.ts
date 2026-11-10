import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ApiLocale } from '../../../common/i18n';
import {
  ContentModerationCaseKind,
  ContentModerationCaseStatus,
  SpecialistProfileRevisionStatus,
  SpecialistWorkPattern,
  SpecialistWorkplaceJoinRequestStatus,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { SpecialistOfferingEdgeLifecycleService } from '../../directory/application/specialist-offering-edge-lifecycle.service';
import { HiringService } from '../../hiring/application/hiring.service';
import { ModerationEnqueueService } from '../../moderation/application/moderation-enqueue.service';
import { recomputeListedInDirectoryTx } from './recompute-specialist-listed-in-directory';
import {
  filterServiceCategoryIdsForOrganizationMajors,
  resolveOrganizationOfferingBootstrapTargets,
} from '../../organizations/infrastructure/organization-offering-bootstrap-targets';
import { ensurePublishedOrgOfferingsForCategories } from '../../organizations/infrastructure/ensure-published-org-offerings-for-categories';
import { syncOrganizationServiceCategoriesFromPublishedOfferings } from '../../organizations/infrastructure/organization-service-category-sync';
import {
  SpecialistCabinetProfileService,
  type SpecialistCabinetVitrine,
} from './specialist-cabinet-profile.service';
import type { PatchSpecialistOnboardingPreferencesBody } from '../dto/patch-specialist-onboarding-preferences.schema';
import type { PatchSpecialistSkillsBody } from '../dto/patch-specialist-skills-body.schema';
import type { PatchSpecialistProfileBody } from '../dto/specialist-body.schema';

const MASSAGE_MAJOR_SLUG = 'massage';

/**
 * Шаги первичного онбординга (`6` — кабинет разблокирован).
 * Смысловой порядок сценариев (major → skills → workplace → offerings) — см. `domain/specialist-onboarding-step-order.ts`.
 */
type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 11 | 12 | 13 | 6;

@Injectable()
export class SpecialistOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderationEnqueue: ModerationEnqueueService,
    private readonly specialistOfferingEdgeLifecycle: SpecialistOfferingEdgeLifecycleService,
    private readonly hiringService: HiringService,
    private readonly cabinetProfile: SpecialistCabinetProfileService,
  ) {}

  private isProfileComplete(
    user: { phone: string | null },
    vitrine: SpecialistCabinetVitrine,
    spec: { experienceYears: number | null; gender: 'male' | 'female' | null },
  ): boolean {
    if (!vitrine.listingName?.trim() || !user.phone?.trim() || !spec.gender) {
      return false;
    }
    if (!vitrine.bio?.trim() || spec.experienceYears == null) {
      return false;
    }
    return true;
  }

  private async countSkillServiceCategories(
    specialistId: string,
  ): Promise<number> {
    return this.prisma.specialistSkill.count({
      where: { specialistId },
    });
  }

  /** Офферы точки по выбранным подкатегориям + теги витрины (перед привязкой SpecialistOffering). */
  private async bootstrapOrgOfferingsForSkillCategories(
    specialistId: string,
    serviceCategoryIds: readonly string[],
  ): Promise<void> {
    if (serviceCategoryIds.length === 0) {
      return;
    }
    const targets = await resolveOrganizationOfferingBootstrapTargets(
      this.prisma,
      specialistId,
    );
    for (const target of targets) {
      const categoryIds = await filterServiceCategoryIdsForOrganizationMajors(
        this.prisma,
        target.organizationId,
        serviceCategoryIds,
      );
      if (categoryIds.length === 0) {
        continue;
      }
      await ensurePublishedOrgOfferingsForCategories(this.prisma, {
        organizationId: target.organizationId,
        orgSlug: target.orgSlug,
        categoryIds,
      });
      await syncOrganizationServiceCategoriesFromPublishedOfferings(
        this.prisma,
        target.organizationId,
      );
    }
  }

  private async bootstrapOrgOfferingsFromCurrentSkills(
    specialistId: string,
  ): Promise<void> {
    const rows = await this.prisma.specialistSkill.findMany({
      where: { specialistId },
      select: { serviceCategoryId: true },
    });
    const ids = rows.map((r) => r.serviceCategoryId);
    await this.bootstrapOrgOfferingsForSkillCategories(specialistId, ids);
  }

  /** Полная замена `SpecialistSkill` с проверкой majors (организация + остаток онбординга до complete). */
  private async replaceSpecialistSkillsTx(
    tx: Prisma.TransactionClient,
    specialist: { id: string },
    serviceCategoryIds: readonly string[],
  ): Promise<void> {
    const allowedMajorIds = new Set<string>();
    const activeWorkplace = await tx.specialistWorkplace.findFirst({
      where: { specialistId: specialist.id, isActive: true, deletedAt: null },
      select: { organizationId: true },
    });
    if (activeWorkplace != null) {
      const orgM = await tx.organizationMajorServiceCategory.findMany({
        where: { organizationId: activeWorkplace.organizationId },
        select: { majorServiceCategoryId: true },
      });
      for (const r of orgM) {
        allowedMajorIds.add(r.majorServiceCategoryId);
      }
    }
    const onbM = await tx.specialistOnboardingMajorServiceCategory.findMany({
      where: { specialistId: specialist.id },
      select: { majorServiceCategoryId: true },
    });
    for (const r of onbM) {
      allowedMajorIds.add(r.majorServiceCategoryId);
    }
    if (allowedMajorIds.size === 0) {
      throw new BadRequestException({
        code: 'SKILL_MAJORS_UNAVAILABLE',
        message:
          'Нет доступных сфер для навыков: выберите большие категории (шаг 3) или организацию с направлениями.',
      });
    }
    const uniqIds = [...new Set(serviceCategoryIds)];
    const categories = await tx.serviceCategory.findMany({
      where: {
        id: { in: uniqIds },
        deletedAt: null,
        isActive: true,
      },
      select: { id: true, majorServiceCategoryId: true },
    });
    if (categories.length !== uniqIds.length) {
      throw new BadRequestException({
        code: 'INVALID_SERVICE_CATEGORY_ID',
        message: 'Одна или несколько подкатегорий недоступны',
      });
    }
    for (const c of categories) {
      if (!allowedMajorIds.has(c.majorServiceCategoryId)) {
        throw new BadRequestException({
          code: 'SERVICE_CATEGORY_MAJOR_MISMATCH',
          message: 'Подкатегория не относится к доступным для профиля сферам',
        });
      }
    }
    await tx.specialistSkill.deleteMany({
      where: { specialistId: specialist.id },
    });
    if (uniqIds.length > 0) {
      await tx.specialistSkill.createMany({
        data: uniqIds.map((serviceCategoryId) => ({
          specialistId: specialist.id,
          serviceCategoryId,
        })),
      });
    }
  }

  private isMassageVerticalComplete(
    mp: {
      pressureLevel: number | null;
      pressureAdaptsToClient: boolean | null;
    } | null,
  ): boolean {
    if (mp == null) {
      return false;
    }
    const levelDefined =
      mp.pressureLevel != null &&
      mp.pressureLevel >= 1 &&
      mp.pressureLevel <= 5;
    return levelDefined || mp.pressureAdaptsToClient === true;
  }

  private workplaceResolved(
    spec: {
      activeOrganizationId: string | null;
      onboardingWorkPattern: SpecialistWorkPattern | null;
    },
    pendingJoin: { id: string } | null,
  ): boolean {
    const pattern = spec.onboardingWorkPattern;
    if (pattern == null) {
      return false;
    }
    if (pattern === SpecialistWorkPattern.employed_salon) {
      return pendingJoin != null || spec.activeOrganizationId != null;
    }
    return spec.activeOrganizationId != null;
  }

  /** Слаги больших категорий: сначала черновик онбординга, иначе сферы активного места приёма. */
  private async sphereSlugsForOnboarding(
    specialistId: string,
  ): Promise<string[]> {
    const row = await this.prisma.specialist.findFirst({
      where: { id: specialistId, deletedAt: null },
      select: {
        onboardingMajorPicks: {
          select: {
            majorServiceCategory: {
              select: { slug: true, sortOrder: true },
            },
          },
        },
        workplaces: {
          where: { isActive: true, deletedAt: null },
          take: 1,
          select: {
            organization: {
              select: {
                deletedAt: true,
                majorServiceCategories: {
                  select: {
                    majorServiceCategory: {
                      select: { slug: true, sortOrder: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (row == null) {
      return [];
    }
    if (row.onboardingMajorPicks.length > 0) {
      return [...row.onboardingMajorPicks]
        .sort(
          (a, b) =>
            a.majorServiceCategory.sortOrder -
              b.majorServiceCategory.sortOrder ||
            a.majorServiceCategory.slug.localeCompare(
              b.majorServiceCategory.slug,
            ),
        )
        .map((r) => r.majorServiceCategory.slug);
    }
    const org = row.workplaces[0]?.organization ?? null;
    if (org == null || org.deletedAt != null) {
      return [];
    }
    return [...org.majorServiceCategories]
      .sort(
        (a, b) =>
          a.majorServiceCategory.sortOrder - b.majorServiceCategory.sortOrder ||
          a.majorServiceCategory.slug.localeCompare(
            b.majorServiceCategory.slug,
          ),
      )
      .map((r) => r.majorServiceCategory.slug);
  }

  private async resolveStep(
    userId: string,
  ): Promise<{ step: OnboardingStep; specialistId: string | null }> {
    const spec = await this.prisma.specialist.findFirst({
      where: { userId, deletedAt: null },
      select: {
        id: true,
        listingName: true,
        bio: true,
        imageUrl: true,
        imageAlt: true,
        experienceYears: true,
        gender: true,
        onboardingWorkPattern: true,
        workplaces: {
          where: { isActive: true, deletedAt: null },
          select: { organizationId: true },
          take: 1,
        },
        onboardingCompletedAt: true,
      },
    });
    if (!spec) {
      return { step: 1, specialistId: null };
    }
    /** Завершённый онбординг не откатываем при снятии места или очистке picks в БД. */
    if (spec.onboardingCompletedAt != null) {
      return { step: 6, specialistId: spec.id };
    }
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { phone: true },
    });
    if (!user) {
      return { step: 1, specialistId: null };
    }
    if (spec.onboardingWorkPattern == null) {
      return { step: 2, specialistId: spec.id };
    }
    const onboardingMajorCount =
      await this.prisma.specialistOnboardingMajorServiceCategory.count({
        where: { specialistId: spec.id },
      });
    if (onboardingMajorCount < 1 && spec.workplaces.length === 0) {
      return { step: 3, specialistId: spec.id };
    }
    const vitrine = await this.cabinetProfile.getCabinetVitrineSnapshot(
      spec.id,
      {
        listingName: spec.listingName,
        bio: spec.bio,
        imageUrl: spec.imageUrl,
        imageAlt: spec.imageAlt,
      },
    );
    if (!this.isProfileComplete(user, vitrine, spec)) {
      return { step: 4, specialistId: spec.id };
    }
    const sphereSlugs = await this.sphereSlugsForOnboarding(spec.id);
    if (sphereSlugs.includes(MASSAGE_MAJOR_SLUG)) {
      const mp = await this.prisma.specialistMassageProfile.findUnique({
        where: { specialistId: spec.id },
      });
      if (!this.isMassageVerticalComplete(mp)) {
        return { step: 5, specialistId: spec.id };
      }
    }
    const pendingJoin =
      await this.prisma.specialistWorkplaceJoinRequest.findFirst({
        where: {
          specialistId: spec.id,
          status: SpecialistWorkplaceJoinRequestStatus.pending,
        },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      });
    if (
      !this.workplaceResolved(
        {
          activeOrganizationId: spec.workplaces[0]?.organizationId ?? null,
          onboardingWorkPattern: spec.onboardingWorkPattern,
        },
        pendingJoin,
      )
    ) {
      return { step: 11, specialistId: spec.id };
    }
    const skillCount = await this.countSkillServiceCategories(spec.id);
    if (skillCount < 1) {
      return { step: 12, specialistId: spec.id };
    }
    return { step: 13, specialistId: spec.id };
  }

  private async mapOnboarding(userId: string): Promise<{
    onboardingStep: OnboardingStep;
  }> {
    const { step } = await this.resolveStep(userId);
    return { onboardingStep: step };
  }

  async getOnboarding(userId: string, locale: ApiLocale = 'en') {
    void locale;
    return this.mapOnboarding(userId);
  }

  async ensureSpecialist(userId: string): Promise<void> {
    const exists = await this.prisma.specialist.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true, onboardingWorkPattern: true },
    });
    if (exists) {
      if (exists.onboardingWorkPattern == null) {
        await this.prisma.specialist.update({
          where: { id: exists.id },
          data: { onboardingWorkPattern: SpecialistWorkPattern.business },
        });
      }
      return;
    }
    await this.prisma.specialist.create({
      data: {
        userId,
        onboardingWorkPattern: SpecialistWorkPattern.business,
        profile: { create: { isActive: true } },
      },
    });
  }

  async patchOnboardingPreferences(
    userId: string,
    body: PatchSpecialistOnboardingPreferencesBody,
    locale: ApiLocale = 'en',
  ) {
    const specialist = await this.prisma.specialist.findFirst({
      where: { userId, deletedAt: null },
    });
    if (!specialist) {
      throw new NotFoundException({
        code: 'SPECIALIST_PROFILE_NOT_FOUND',
        message: 'Specialist profile not found for this user',
      });
    }
    if (specialist.onboardingCompletedAt != null) {
      throw new ConflictException({
        code: 'ONBOARDING_ALREADY_COMPLETED',
        message: 'Onboarding уже завершён',
      });
    }
    const hasActiveWorkplace =
      (await this.prisma.specialistWorkplace.count({
        where: {
          specialistId: specialist.id,
          isActive: true,
          deletedAt: null,
        },
      })) > 0;
    if (body.majorCategorySlugs !== undefined && hasActiveWorkplace) {
      throw new ConflictException({
        code: 'ONBOARDING_MAJORS_LOCKED',
        message:
          'Сферы для привязанного места приёма задаёт организация; этот список менять нельзя',
      });
    }
    if (
      hasActiveWorkplace &&
      body.workPattern !== undefined &&
      body.workPattern !== specialist.onboardingWorkPattern
    ) {
      throw new ConflictException({
        code: 'ONBOARDING_WORK_PATTERN_LOCKED',
        message:
          'Нельзя менять режим работы после привязки к организации через онбординг',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      if (body.workPattern !== undefined) {
        await tx.specialistWorkplaceJoinRequest.updateMany({
          where: {
            specialistId: specialist.id,
            status: SpecialistWorkplaceJoinRequestStatus.pending,
          },
          data: {
            status: SpecialistWorkplaceJoinRequestStatus.withdrawn,
            resolvedAt: new Date(),
          },
        });
        await tx.specialist.update({
          where: { id: specialist.id },
          data: { onboardingWorkPattern: body.workPattern },
        });
      }

      if (body.majorCategorySlugs !== undefined) {
        const uniq = [...new Set(body.majorCategorySlugs)];
        const majors = await tx.majorServiceCategory.findMany({
          where: {
            slug: { in: uniq },
            deletedAt: null,
            isActive: true,
          },
          select: { id: true, slug: true },
        });
        if (majors.length !== uniq.length) {
          throw new BadRequestException({
            code: 'INVALID_MAJOR_CATEGORY_SLUG',
            message: 'Один или несколько недопустимых slug больших категорий',
          });
        }
        await tx.specialistOnboardingMajorServiceCategory.deleteMany({
          where: { specialistId: specialist.id },
        });
        if (majors.length > 0) {
          await tx.specialistOnboardingMajorServiceCategory.createMany({
            data: majors.map((m) => ({
              specialistId: specialist.id,
              majorServiceCategoryId: m.id,
            })),
          });
        }
      }

      if (body.serviceCategoryIds !== undefined) {
        await this.replaceSpecialistSkillsTx(
          tx,
          specialist,
          body.serviceCategoryIds,
        );
      }
    });

    if (body.serviceCategoryIds !== undefined) {
      await this.bootstrapOrgOfferingsForSkillCategories(
        specialist.id,
        body.serviceCategoryIds,
      );
      await this.specialistOfferingEdgeLifecycle.reconcileAssignmentsForSpecialist(
        specialist.id,
      );
      await this.hiringService.rebuildSpecialistSearchProjection(specialist.id);
    }

    void locale;
    return this.mapOnboarding(userId);
  }

  /** Кабинет после онбординга: полная замена навыков (`SpecialistSkill`). */
  async patchCabinetSkills(
    userId: string,
    body: PatchSpecialistSkillsBody,
    locale: ApiLocale = 'en',
  ) {
    const specialist = await this.prisma.specialist.findFirst({
      where: { userId, deletedAt: null },
    });
    if (!specialist) {
      throw new NotFoundException({
        code: 'SPECIALIST_PROFILE_NOT_FOUND',
        message: 'Specialist profile not found for this user',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await this.replaceSpecialistSkillsTx(
        tx,
        specialist,
        body.serviceCategoryIds,
      );
    });
    await this.bootstrapOrgOfferingsForSkillCategories(
      specialist.id,
      body.serviceCategoryIds,
    );
    await this.specialistOfferingEdgeLifecycle.reconcileAssignmentsForSpecialist(
      specialist.id,
    );
    await this.hiringService.rebuildSpecialistSearchProjection(specialist.id);
    void locale;
    return this.mapOnboarding(userId);
  }

  async patchProfile(
    userId: string,
    body: PatchSpecialistProfileBody,
    locale: ApiLocale = 'en',
  ) {
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
        gender?: 'male' | 'female';
      } = {};
      if (body.experienceYears !== undefined) {
        specData.experienceYears = body.experienceYears;
      }
      if (body.gender !== undefined) {
        specData.gender = body.gender;
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
    if (body.experienceYears !== undefined) {
      await this.hiringService.rebuildSpecialistSearchProjection(spec.id);
    }

    void locale;
    return this.mapOnboarding(userId);
  }

  async completeOnboarding(userId: string, locale: ApiLocale = 'en') {
    const { step, specialistId } = await this.resolveStep(userId);
    if (!specialistId) {
      throw new NotFoundException({
        code: 'SPECIALIST_PROFILE_NOT_FOUND',
        message: 'Specialist profile not found for this user',
      });
    }
    if (step !== 13) {
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
    await this.prisma.$transaction(async (tx) => {
      await tx.specialistOnboardingMajorServiceCategory.deleteMany({
        where: { specialistId: spec.id },
      });
      await tx.specialist.update({
        where: { id: spec.id },
        data: {
          onboardingCompletedAt: now,
        },
      });
      await recomputeListedInDirectoryTx(tx, spec.id);
    });
    await this.bootstrapOrgOfferingsFromCurrentSkills(spec.id);
    await this.specialistOfferingEdgeLifecycle.reconcileAssignmentsForSpecialist(
      spec.id,
    );
    void locale;
    return this.mapOnboarding(userId);
  }
}
