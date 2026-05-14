import { Injectable } from '@nestjs/common';
import {
  PublicationModerationStatus,
  SpecialistProfileRevisionStatus,
  SpecialistWorkplaceJoinRequestStatus,
} from '@prisma/client';
import type { ApiLocale } from '../../../common/i18n';
import {
  pickLocalizedServiceCategoryFields,
  type CategoryLocaleShape,
} from '../../../common/i18n/locale-table.resolver';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { mergeOrganizationMajorIdsAndSlugsFromDb } from '../../organizations/lib/merge-organization-major-categories';

export type SpecialistCabinetVitrine = {
  listingName: string | null;
  bio: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
};

@Injectable()
export class SpecialistCabinetProfileService {
  constructor(private readonly prisma: PrismaService) {}

  /** Черновик на модерации имеет приоритет над опубликованными колонками `Specialist` в кабинете. */
  async getCabinetVitrineSnapshot(
    specialistId: string,
    published: SpecialistCabinetVitrine,
  ): Promise<SpecialistCabinetVitrine> {
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

  /**
   * Снимок полей специалиста для кабинета.
   * Используется самим мастером и владельцем организации при просмотре заявителя.
   */
  async buildSpecialistCabinetSnapshotForSpecialistId(
    specialistId: string,
    locale: ApiLocale = 'en',
  ): Promise<Record<string, unknown> | null> {
    const spec = await this.prisma.specialist.findFirst({
      where: { id: specialistId, deletedAt: null },
      include: {
        massageProfile: true,
        workplaces: {
          where: { isActive: true, deletedAt: null },
          select: { organizationId: true },
          take: 1,
        },
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

    const skillCategoryRows = await this.prisma.specialistSkill.findMany({
      where: { specialistId: spec.id },
      include: {
        serviceCategory: {
          include: {
            majorServiceCategory: {
              select: { slug: true, sortOrder: true },
            },
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
    });
    const skillCategoriesSorted = [...skillCategoryRows].sort((a, b) => {
      const ao = a.serviceCategory.majorServiceCategory.sortOrder;
      const bo = b.serviceCategory.majorServiceCategory.sortOrder;
      if (ao !== bo) {
        return ao - bo;
      }
      const an = pickLocalizedServiceCategoryFields(
        a.serviceCategory as CategoryLocaleShape,
        locale,
      ).name;
      const bn = pickLocalizedServiceCategoryFields(
        b.serviceCategory as CategoryLocaleShape,
        locale,
      ).name;
      return an.localeCompare(bn, undefined, { sensitivity: 'base' });
    });

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
    const activeWorkplaceOrganizationId =
      spec.workplaces[0]?.organizationId ?? null;
    if (activeWorkplaceOrganizationId != null) {
      const orgRowEarly = await this.prisma.organization.findFirst({
        where: { id: activeWorkplaceOrganizationId, deletedAt: null },
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
      activeOrganizationId: activeWorkplaceOrganizationId,
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
      skillServiceCategoryIds: skillCategoriesSorted.map(
        (r) => r.serviceCategoryId,
      ),
      skillCategories: skillCategoriesSorted.map((r) => ({
        categoryId: r.serviceCategoryId,
        name: pickLocalizedServiceCategoryFields(
          r.serviceCategory as CategoryLocaleShape,
          locale,
        ).name,
      })),
    };

    if (activeWorkplaceOrganizationId == null) {
      return basePayload;
    }

    return {
      ...basePayload,
      activeWorkplaceMajorCategorySlugs,
    };
  }

  async getCabinetProfile(
    userId: string,
    locale: ApiLocale = 'en',
  ): Promise<{ specialist: Record<string, unknown> | null }> {
    const spec = await this.prisma.specialist.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    if (!spec) {
      return { specialist: null };
    }
    const specialist = await this.buildSpecialistCabinetSnapshotForSpecialistId(
      spec.id,
      locale,
    );
    return { specialist };
  }
}
