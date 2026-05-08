import {
  BadRequestException,
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
  ServiceCatalogScope,
  SpecialistProfileRevisionStatus,
  SpecialistWorkPattern,
  SpecialistWorkplaceJoinRequestStatus,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { mergeOrganizationMajorIdsAndSlugsFromDb } from '../../organizations/lib/merge-organization-major-categories';
import { ModerationEnqueueService } from '../../moderation/application/moderation-enqueue.service';
import { computeListedInDirectory } from '../domain/specialist-directory-flags';
import type { PatchSpecialistOnboardingPreferencesBody } from '../dto/patch-specialist-onboarding-preferences.schema';
import type { PatchSpecialistProfileBody } from '../dto/specialist-body.schema';

const MASSAGE_MAJOR_SLUG = 'massage';

/** Шаги первичного онбординга (`6` — кабинет разблокирован). */
type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 11 | 12 | 13 | 6;

type CabinetVitrine = {
  listingName: string | null;
  bio: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
};

function joinComboServiceDisplayName(args: {
  baseName: string;
  comboNames: string[];
}): string {
  return [args.baseName, ...args.comboNames]
    .map((s) => s.trim())
    .filter((s, idx, arr) => s.length > 0 && arr.indexOf(s) === idx)
    .join(' + ');
}

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

  private async countPersonalServices(specialistId: string): Promise<number> {
    return this.prisma.service.count({
      where: {
        specialistId,
        scope: ServiceCatalogScope.personal,
        deletedAt: null,
      },
    });
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

  /** Слаги больших категорий: сначала черновик онбординга, иначе сферы активной организации. */
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
        activeOrganization: {
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
    const org = row.activeOrganization;
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
        activeOrganizationId: true,
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
    if (onboardingMajorCount < 1 && spec.activeOrganizationId == null) {
      return { step: 3, specialistId: spec.id };
    }
    const vitrine = await this.getCabinetVitrineSnapshot(spec.id, {
      listingName: spec.listingName,
      bio: spec.bio,
      imageUrl: spec.imageUrl,
      imageAlt: spec.imageAlt,
    });
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
    if (!this.workplaceResolved(spec, pendingJoin)) {
      return { step: 11, specialistId: spec.id };
    }
    const svcCount = await this.countPersonalServices(spec.id);
    const personalCatalogSkippableForEmployedPath =
      spec.onboardingWorkPattern === SpecialistWorkPattern.employed_salon &&
      this.workplaceResolved(spec, pendingJoin);
    if (svcCount < 1 && !personalCatalogSkippableForEmployedPath) {
      return { step: 12, specialistId: spec.id };
    }
    return { step: 13, specialistId: spec.id };
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
      include: {
        massageProfile: true,
        onboardingMajorPicks: {
          include: {
            majorServiceCategory: { select: { slug: true, sortOrder: true } },
          },
        },
      },
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

    let activeWorkplaceMajorCategorySlugs: string[] = [];
    if (spec.activeOrganizationId != null) {
      const orgRowEarly = await this.prisma.organization.findFirst({
        where: { id: spec.activeOrganizationId, deletedAt: null },
        select: {
          majorServiceCategories: {
            include: {
              majorServiceCategory: {
                select: { id: true, slug: true, sortOrder: true },
              },
            },
          },
        },
      });
      if (orgRowEarly != null) {
        activeWorkplaceMajorCategorySlugs =
          mergeOrganizationMajorIdsAndSlugsFromDb(orgRowEarly).slugs;
      }
    }
    const workplaceMajorSlugSet = new Set(activeWorkplaceMajorCategorySlugs);

    const personalServiceRows = await this.prisma.service.findMany({
      where: {
        specialistId: spec.id,
        scope: ServiceCatalogScope.personal,
        deletedAt: null,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        category: {
          include: {
            majorServiceCategory: { select: { slug: true } },
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
        comboItems: {
          orderBy: { sortOrder: 'asc' },
          select: {
            itemServiceCategoryId: true,
            itemServiceCategory: {
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
          },
        },
        bodyZones: {
          select: {
            bodyZone: {
              select: { slug: true },
            },
          },
        },
      },
    });

    const listedAtActiveWorkplaceForRow = (
      row: (typeof personalServiceRows)[number],
    ): boolean => {
      if (!row.isActive) {
        return false;
      }
      if (spec.activeOrganizationId == null) {
        return true;
      }
      if (workplaceMajorSlugSet.size === 0) {
        return false;
      }
      const slug = row.category.majorServiceCategory?.slug;
      return (
        typeof slug === 'string' &&
        slug.length > 0 &&
        workplaceMajorSlugSet.has(slug)
      );
    };

    const personalServices = personalServiceRows.map((row) => ({
      // В кабинете показываем читаемое имя combo как "Услуга + Услуга".
      ...(() => {
        const base = pickLocalizedServiceCategoryFields(
          row.category as CategoryLocaleShape,
          locale,
        );
        const comboNames =
          row.kind === 'combo'
            ? row.comboItems.map(
                (item) =>
                  pickLocalizedServiceCategoryFields(
                    item.itemServiceCategory as CategoryLocaleShape,
                    locale,
                  ).name,
              )
            : [];
        return {
          categoryName: joinComboServiceDisplayName({
            baseName: base.name,
            comboNames,
          }),
          comboCategoryNames: comboNames,
        };
      })(),
      id: row.id,
      categoryId: row.categoryId,
      listedAtActiveWorkplace: listedAtActiveWorkplaceForRow(row),
      description: row.description,
      kind: row.kind,
      comboCategoryIds: row.comboItems.map(
        (item) => item.itemServiceCategoryId,
      ),
      bodyZoneSlugs: row.bodyZones.map((item) => item.bodyZone.slug),
      priceOptions: row.priceOptions.map((o) => ({
        durationMinutes: o.durationMinutes,
        priceAmount: o.priceAmount,
        currency: o.currency,
      })),
    }));

    /** Пока висит черновик ревизии — в кабинете показываем «на модерации», как у салона с pending revision. */
    const pendingProfileRevision =
      await this.prisma.specialistProfileRevision.findFirst({
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

    const onboardingMajorCategorySlugs = [...spec.onboardingMajorPicks]
      .sort(
        (a, b) =>
          a.majorServiceCategory.sortOrder - b.majorServiceCategory.sortOrder ||
          a.majorServiceCategory.slug.localeCompare(
            b.majorServiceCategory.slug,
          ),
      )
      .map((r) => r.majorServiceCategory.slug);

    const basePayload = {
      id: spec.id,
      userId: spec.userId,
      bio: vitrine.bio,
      experienceYears: spec.experienceYears,
      listingName: vitrine.listingName,
      imageUrl: vitrine.imageUrl,
      imageAlt: vitrine.imageAlt,
      profilePublicationModerationStatus:
        profilePublicationModerationStatusForCabinet,
      gender: spec.gender,
      onboardingWorkPattern: spec.onboardingWorkPattern,
      onboardingMajorCategorySlugs,
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

    if (spec.activeOrganizationId == null) {
      return basePayload;
    }

    return {
      ...basePayload,
      activeWorkplaceMajorCategorySlugs: activeWorkplaceMajorCategorySlugs,
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
    if (
      body.majorCategorySlugs !== undefined &&
      specialist.activeOrganizationId != null
    ) {
      throw new ConflictException({
        code: 'ONBOARDING_MAJORS_LOCKED',
        message:
          'Сферы для привязанного места приёма задаёт организация; этот список менять нельзя',
      });
    }
    if (
      specialist.activeOrganizationId != null &&
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
    });

    return this.mapOnboarding(userId, locale);
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

    return this.mapOnboarding(userId, locale);
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
          listedInDirectory: computeListedInDirectory({
            onboardingCompletedAt: now,
            activeOrganizationId: spec.activeOrganizationId,
          }),
        },
      });
    });
    return this.mapOnboarding(userId, locale);
  }
}
