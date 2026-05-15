import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  OfferingPriceOptionStatus,
  OfferingPublicationStatus,
  Prisma,
  SpecialistOfferingStatus,
} from '@prisma/client';
import type { ApiLocale } from '../../../common/i18n';
import { resolveLocalizedString } from '../../../common/i18n';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { MarketplaceListingEdgesIndexService } from '../../directory/application/marketplace-listing-edges-index.service';
import { SpecialistOfferingEdgeLifecycleService } from '../../directory/application/specialist-offering-edge-lifecycle.service';
import { getAllowedBodyZoneSlugsForCategory } from '../../specialists/domain/body-zone-compatibility';
import { syncOrganizationServiceCategoriesFromPublishedOfferings } from '../infrastructure/organization-service-category-sync';
import { OrganizationAccessPolicyService } from './organization-access-policy.service';
import { OrganizationCapabilities } from '../domain/policy';
import type { PatchOrganizationOfferingBody } from '../dto/patch-organization-offering-body.schema';
import type { PostOfferingPriceOptionBody } from '../dto/post-offering-price-option-body.schema';
import type { PatchOfferingPriceOptionBody } from '../dto/patch-offering-price-option-body.schema';
import type { PatchSpecialistOfferingAssignmentBody } from '../dto/patch-specialist-offering-assignment-body.schema';
import type { PatchSpecialistOfferingPriceOverrideBody } from '../dto/patch-specialist-offering-price-override-body.schema';
import type { PostSpecialistOfferingPriceOverrideBody } from '../dto/post-specialist-offering-price-override-body.schema';

@Injectable()
export class OrganizationOfferingsCabinetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listingEdges: MarketplaceListingEdgesIndexService,
    private readonly edgeLifecycle: SpecialistOfferingEdgeLifecycleService,
    private readonly organizationAccess: OrganizationAccessPolicyService,
  ) {}

  private async assertUserCanViewOrganizationOfferings(
    userId: string,
    organizationId: string,
  ): Promise<void> {
    await this.organizationAccess.assertCan(
      userId,
      organizationId,
      OrganizationCapabilities.OFFERINGS_VIEW,
      { type: 'Organization', organizationId },
    );
  }

  private async assertUserCanManageOrganizationOfferings(
    userId: string,
    organizationId: string,
  ): Promise<void> {
    await this.organizationAccess.assertCan(
      userId,
      organizationId,
      OrganizationCapabilities.OFFERINGS_MANAGE,
      { type: 'Organization', organizationId },
    );
  }

  private async getOrganizationMajorCategoryIds(
    organizationId: string,
  ): Promise<string[]> {
    const rows = await this.prisma.organizationMajorServiceCategory.findMany({
      where: { organizationId },
      select: { majorServiceCategoryId: true },
    });
    return rows.map((r) => r.majorServiceCategoryId);
  }

  /** Как у {@link OrganizationCabinetService.assertServiceCategoriesBelongToOrganizationMajors}: только majors точки. */
  private async assertServiceCategoriesBelongToOrganizationMajors(
    serviceCategoryIds: string[],
    organizationMajorCategoryIds: string[],
  ): Promise<void> {
    if (serviceCategoryIds.length === 0) {
      return;
    }
    if (organizationMajorCategoryIds.length === 0) {
      throw new BadRequestException({
        code: 'SERVICE_CATEGORIES_REQUIRE_ORGANIZATION_MAJORS',
        message:
          'Cannot attach service categories while the organization has no activity majors selected',
      });
    }
    const allowed = new Set<string>(organizationMajorCategoryIds);
    const rows = await this.prisma.serviceCategory.findMany({
      where: {
        id: { in: serviceCategoryIds },
        deletedAt: null,
        isActive: true,
      },
      select: { id: true, majorServiceCategoryId: true },
    });
    if (rows.length !== serviceCategoryIds.length) {
      throw new BadRequestException({
        code: 'INVALID_SERVICE_CATEGORIES',
        message: 'One or more service categories are invalid or inactive',
      });
    }
    for (const row of rows) {
      if (!allowed.has(row.majorServiceCategoryId)) {
        throw new BadRequestException({
          code: 'SERVICE_CATEGORY_MAJOR_NOT_ALLOWED_FOR_ORGANIZATION',
          message:
            'One or more service categories belong to a major not enabled for this organization',
        });
      }
    }
  }

  /** После мутаций офера/переопубликовать — переиндексация рёбер активных специалистов точки. */
  private async reconcileListingEdgesForOrganization(
    organizationId: string,
  ): Promise<void> {
    const emps = await this.prisma.specialistOrganizationEmployment.findMany({
      where: { organizationId, isActive: true },
      select: { specialistId: true },
    });
    const specialistIds = [...new Set(emps.map((e) => e.specialistId))];
    for (const specialistId of specialistIds) {
      await this.edgeLifecycle.reconcileAssignmentsForSpecialist(specialistId);
    }
  }

  /** Точечная переиндексация после правки одной привязки мастера. */
  private async refreshEdgesForSpecialist(specialistId: string): Promise<void> {
    await this.edgeLifecycle.reconcileAssignmentsForSpecialist(specialistId);
  }

  private async ensureSpecialistEmployedAtOrganization(params: {
    organizationId: string;
    specialistId: string;
  }): Promise<void> {
    const emp =
      await this.prisma.specialistOrganizationEmployment.findFirst({
        where: {
          organizationId: params.organizationId,
          specialistId: params.specialistId,
          isActive: true,
        },
        select: { id: true },
      });
    if (!emp) {
      throw new BadRequestException({
        code: 'SPECIALIST_NOT_EMPLOYED_AT_ORGANIZATION',
        message: 'Specialist does not have active employment at this organization',
      });
    }
  }

  private async assertSpecialistHasOfferingSkill(params: {
    specialistId: string;
    categoryId: string;
  }): Promise<void> {
    const skill = await this.prisma.specialistSkill.findUnique({
      where: {
        specialistId_serviceCategoryId: {
          specialistId: params.specialistId,
          serviceCategoryId: params.categoryId,
        },
      },
      select: { specialistId: true },
    });
    if (!skill) {
      throw new BadRequestException({
        code: 'SPECIALIST_SKILL_REQUIRED_FOR_OFFERING_CATEGORY',
        message: 'Specialist must have the offering category skill',
      });
    }
  }

  private pickOfferingText(row: {
    title: string;
    description: string | null;
    locales: { locale: string; title: string; description: string | null }[];
  }, locale: ApiLocale) {
    const title = resolveLocalizedString(
      locale,
      row.locales,
      (l) => l.title,
      row.title,
    );
    const hit = row.locales.find((l) => l.locale === locale);
    const en = row.locales.find((l) => l.locale === 'en');
    const description =
      hit?.description?.trim() ||
      en?.description?.trim() ||
      row.description?.trim() ||
      null;
    return { title, description };
  }

  private pickBodyZoneName(
    row: { slug: string; locales: { locale: string; name: string }[] },
    locale: ApiLocale,
  ): string {
    return resolveLocalizedString(locale, row.locales, (l) => l.name, row.slug);
  }

  private async eligibleSpecialistsByCategory(
    organizationId: string,
    categoryIds: string[],
  ): Promise<Map<string, Array<{ specialistId: string; displayName: string | null }>>> {
    const uniqCategoryIds = [...new Set(categoryIds)];
    const byCategory = new Map<
      string,
      Array<{ specialistId: string; displayName: string | null }>
    >();
    for (const id of uniqCategoryIds) {
      byCategory.set(id, []);
    }
    if (uniqCategoryIds.length === 0) {
      return byCategory;
    }
    const rows = await this.prisma.specialistOrganizationEmployment.findMany({
      where: {
        organizationId,
        isActive: true,
        specialist: {
          deletedAt: null,
          skills: { some: { serviceCategoryId: { in: uniqCategoryIds } } },
        },
      },
      distinct: ['specialistId'],
      select: {
        specialistId: true,
        specialist: {
          select: {
            listingName: true,
            user: { select: { name: true } },
            skills: {
              where: { serviceCategoryId: { in: uniqCategoryIds } },
              select: { serviceCategoryId: true },
            },
          },
        },
      },
    });
    for (const row of rows) {
      const displayName =
        row.specialist.listingName?.trim() ||
        row.specialist.user?.name?.trim() ||
        null;
      for (const skill of row.specialist.skills) {
        byCategory.get(skill.serviceCategoryId)?.push({
          specialistId: row.specialistId,
          displayName,
        });
      }
    }
    return byCategory;
  }

  private async validateOfferingBodyZones(params: {
    categoryId: string;
    bodyZoneIds: readonly string[];
  }): Promise<void> {
    const uniqBodyZoneIds = [...new Set(params.bodyZoneIds)];
    const category = await this.prisma.serviceCategory.findFirst({
      where: { id: params.categoryId, deletedAt: null, isActive: true },
      select: {
        slug: true,
        majorServiceCategory: { select: { slug: true, id: true } },
      },
    });
    if (!category) {
      throw new BadRequestException({
        code: 'INVALID_SERVICE_CATEGORIES',
        message: 'Offering category is invalid or inactive',
      });
    }
    const majorSlug = category.majorServiceCategory.slug;
    if (majorSlug !== 'massage') {
      if (uniqBodyZoneIds.length > 0) {
        throw new BadRequestException({
          code: 'BODY_ZONES_NOT_ALLOWED_FOR_MAJOR',
          message: 'Body zones are only supported for massage offerings',
        });
      }
      return;
    }
    if (uniqBodyZoneIds.length === 0) {
      return;
    }
    const bodyZones = await this.prisma.bodyZone.findMany({
      where: {
        id: { in: uniqBodyZoneIds },
        majorServiceCategoryId: category.majorServiceCategory.id,
        deletedAt: null,
        isActive: true,
      },
      select: { id: true, slug: true },
    });
    if (bodyZones.length !== uniqBodyZoneIds.length) {
      throw new BadRequestException({
        code: 'INVALID_BODY_ZONES',
        message: 'One or more body zones are invalid or inactive',
      });
    }
    const allowed = new Set(
      getAllowedBodyZoneSlugsForCategory({
        majorSlug,
        categorySlug: category.slug,
      }),
    );
    for (const zone of bodyZones) {
      if (!allowed.has(zone.slug)) {
        throw new BadRequestException({
          code: 'BODY_ZONE_NOT_ALLOWED_FOR_CATEGORY',
          message: 'One or more body zones are not allowed for this category',
        });
      }
    }
  }

  private async replaceOfferingBodyZones(
    tx: Prisma.TransactionClient,
    offeringId: string,
    bodyZoneIds: readonly string[],
  ): Promise<void> {
    await tx.organizationOfferingBodyZone.deleteMany({
      where: { organizationOfferingId: offeringId },
    });
    const uniqIds = [...new Set(bodyZoneIds)];
    if (uniqIds.length === 0) {
      return;
    }
    await tx.organizationOfferingBodyZone.createMany({
      data: uniqIds.map((bodyZoneId) => ({
        organizationOfferingId: offeringId,
        bodyZoneId,
      })),
    });
  }

  private async upsertOfferingLocales(
    tx: Prisma.TransactionClient,
    offeringId: string,
    locales:
      | Array<{ locale: ApiLocale; title: string; description?: string | null }>
      | undefined,
  ): Promise<void> {
    if (locales == null) {
      return;
    }
    const deduped = new Map<ApiLocale, { title: string; description?: string | null }>();
    for (const locale of locales) {
      deduped.set(locale.locale, {
        title: locale.title.trim(),
        description:
          locale.description !== undefined
            ? locale.description?.trim() || null
            : undefined,
      });
    }
    for (const [locale, row] of deduped) {
      await tx.organizationOfferingLocale.upsert({
        where: {
          organizationOfferingId_locale: {
            organizationOfferingId: offeringId,
            locale,
          },
        },
        create: {
          organizationOfferingId: offeringId,
          locale,
          title: row.title,
          description: row.description ?? null,
        },
        update: {
          title: row.title,
          ...(row.description !== undefined
            ? { description: row.description }
            : {}),
        },
      });
    }
  }

  private mapOfferingRow(
    row: {
      id: string;
      slug: string;
      title: string;
      description: string | null;
      publicationStatus: OfferingPublicationStatus;
      firstPublishedAt: Date | null;
      lastPublishedAt: Date | null;
      categoryId: string;
      category: {
        id: string;
        slug: string;
        name: string;
        shortName: string;
        majorServiceCategory: { id: string; slug: string; name: string };
        locales: {
          locale: string;
          name: string;
          shortName: string;
          description: string | null;
        }[];
      };
      locales: { locale: string; title: string; description: string | null }[];
      bodyZones: {
        bodyZone: {
          id: string;
          slug: string;
          locales: { locale: string; name: string }[];
        };
      }[];
      priceOptions: {
        id: string;
        durationMinutes: number;
        priceAmount: number;
        currency: string;
        status: OfferingPriceOptionStatus;
      }[];
      specialistAssignments: {
        id: string;
        specialistId: string;
        status: SpecialistOfferingStatus;
        specialist: { listingName: string | null; user: { name: string | null } | null };
        priceOverrides: {
          id: string;
          offeringPriceOptionId: string;
          customPrice: number;
        }[];
      }[];
    },
    locale: ApiLocale,
    eligibleByCategory: Map<string, Array<{ specialistId: string; displayName: string | null }>>,
  ) {
    const text = this.pickOfferingText(row, locale);
    return {
      ...row,
      title: text.title,
      description: text.description,
      category: {
        id: row.category.id,
        slug: row.category.slug,
        name: resolveLocalizedString(
          locale,
          row.category.locales,
          (l) => l.name,
          row.category.name,
        ),
        shortName: resolveLocalizedString(
          locale,
          row.category.locales,
          (l) => l.shortName,
          row.category.shortName,
        ),
        majorCategory: {
          id: row.category.majorServiceCategory.id,
          slug: row.category.majorServiceCategory.slug,
          name: row.category.majorServiceCategory.name,
        },
      },
      locales: row.locales,
      bodyZones: row.bodyZones.map((z) => ({
        id: z.bodyZone.id,
        slug: z.bodyZone.slug,
        name: this.pickBodyZoneName(z.bodyZone, locale),
      })),
      eligibleSpecialists: eligibleByCategory.get(row.categoryId) ?? [],
      specialistAssignments: row.specialistAssignments.map((a) => ({
        id: a.id,
        specialistId: a.specialistId,
        status: a.status,
        displayName:
          a.specialist.listingName?.trim() ||
          a.specialist.user?.name?.trim() ||
          null,
        priceOverrides: a.priceOverrides,
      })),
    };
  }

  private offeringSelect() {
    return {
      id: true,
      slug: true,
      title: true,
      description: true,
      publicationStatus: true,
      firstPublishedAt: true,
      lastPublishedAt: true,
      categoryId: true,
      category: {
        select: {
          id: true,
          slug: true,
          name: true,
          shortName: true,
          majorServiceCategory: { select: { id: true, slug: true, name: true } },
          locales: {
            orderBy: { locale: 'asc' as const },
            select: {
              locale: true,
              name: true,
              shortName: true,
              description: true,
            },
          },
        },
      },
      locales: {
        orderBy: { locale: 'asc' as const },
        select: { locale: true, title: true, description: true },
      },
      bodyZones: {
        select: {
          bodyZone: {
            select: {
              id: true,
              slug: true,
              locales: {
                orderBy: { locale: 'asc' as const },
                select: { locale: true, name: true },
              },
            },
          },
        },
      },
      priceOptions: {
        where: { deletedAt: null },
        orderBy: [{ sortOrder: 'asc' as const }, { durationMinutes: 'asc' as const }],
        select: {
          id: true,
          durationMinutes: true,
          priceAmount: true,
          currency: true,
          status: true,
        },
      },
      specialistAssignments: {
        where: { deletedAt: null },
        select: {
          id: true,
          specialistId: true,
          status: true,
          specialist: {
            select: {
              listingName: true,
              user: { select: { name: true } },
            },
          },
          priceOverrides: {
            select: {
              id: true,
              offeringPriceOptionId: true,
              customPrice: true,
            },
          },
        },
      },
    } satisfies Prisma.OrganizationOfferingSelect;
  }

  async listOfferings(
    userId: string,
    organizationId: string,
    locale: ApiLocale = 'en',
  ) {
    await this.assertUserCanViewOrganizationOfferings(userId, organizationId);
    const rows = await this.prisma.organizationOffering.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: this.offeringSelect(),
    });
    const eligibleByCategory = await this.eligibleSpecialistsByCategory(
      organizationId,
      rows.map((r) => r.categoryId),
    );
    const offerings = rows.map((row) =>
      this.mapOfferingRow(row, locale, eligibleByCategory),
    );
    return { offerings };
  }

  async getOffering(
    userId: string,
    organizationId: string,
    offeringId: string,
    locale: ApiLocale = 'en',
  ) {
    await this.assertUserCanViewOrganizationOfferings(userId, organizationId);
    const row = await this.prisma.organizationOffering.findFirst({
      where: { id: offeringId, organizationId, deletedAt: null },
      select: this.offeringSelect(),
    });
    if (!row) {
      throw new NotFoundException({
        code: 'ORGANIZATION_OFFERING_NOT_FOUND',
        message: 'Offering not found',
      });
    }
    const eligibleByCategory = await this.eligibleSpecialistsByCategory(
      organizationId,
      [row.categoryId],
    );
    return { offering: this.mapOfferingRow(row, locale, eligibleByCategory) };
  }

  async createOfferingDraft(
    userId: string,
    organizationId: string,
    body: {
      title: string;
      slug: string;
      categoryId: string;
      description?: string | null;
      bodyZoneIds?: string[];
      locales?: Array<{
        locale: ApiLocale;
        title: string;
        description?: string | null;
      }>;
    },
  ) {
    await this.assertUserCanManageOrganizationOfferings(userId, organizationId);
    const majors = await this.getOrganizationMajorCategoryIds(organizationId);
    await this.assertServiceCategoriesBelongToOrganizationMajors(
      [body.categoryId],
      majors,
    );
    await this.validateOfferingBodyZones({
      categoryId: body.categoryId,
      bodyZoneIds: body.bodyZoneIds ?? [],
    });
    const slug = body.slug.trim().toLowerCase();
    const dup = await this.prisma.organizationOffering.findFirst({
      where: {
        organizationId,
        slug,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (dup) {
      throw new ConflictException({
        code: 'OFFERING_SLUG_TAKEN',
        message: 'Slug already in use for this organization',
      });
    }
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.organizationOffering.create({
        data: {
          organizationId,
          categoryId: body.categoryId,
          slug,
          title: body.title.trim(),
          description:
            body.description != null ? body.description.trim() || null : null,
          publicationStatus: OfferingPublicationStatus.draft,
        },
        select: {
          id: true,
          slug: true,
          title: true,
          publicationStatus: true,
        },
      });
      await this.replaceOfferingBodyZones(
        tx,
        created.id,
        body.bodyZoneIds ?? [],
      );
      await this.upsertOfferingLocales(tx, created.id, body.locales);
      return created;
    });
    return row;
  }

  async listAssignableSpecialists(userId: string, organizationId: string) {
    await this.assertUserCanManageOrganizationOfferings(userId, organizationId);
    const rows = await this.prisma.specialistOrganizationEmployment.findMany({
      where: { organizationId, isActive: true },
      distinct: ['specialistId'],
      select: {
        specialistId: true,
        specialist: {
          select: {
            listingName: true,
            user: { select: { name: true } },
          },
        },
      },
    });
    const specialists = rows.map((r) => ({
      specialistId: r.specialistId,
      displayName:
        r.specialist.listingName?.trim() ||
        r.specialist.user?.name?.trim() ||
        null,
    }));
    return { specialists };
  }

  async patchOffering(
    userId: string,
    organizationId: string,
    offeringId: string,
    body: PatchOrganizationOfferingBody,
  ) {
    await this.assertUserCanManageOrganizationOfferings(userId, organizationId);
    const off = await this.prisma.organizationOffering.findFirst({
      where: {
        id: offeringId,
        organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        firstPublishedAt: true,
        categoryId: true,
        slug: true,
      },
    });
    if (!off) {
      throw new NotFoundException({
        code: 'ORGANIZATION_OFFERING_NOT_FOUND',
        message: 'Offering not found',
      });
    }
    const unpublished = off.firstPublishedAt == null;

    let nextCategoryId = body.categoryId;
    let nextSlug =
      body.slug == null ? undefined : body.slug.trim().toLowerCase();

    if (
      body.categoryId != null &&
      !unpublished &&
      body.categoryId !== off.categoryId
    ) {
      throw new BadRequestException({
        code: 'OFFERING_CATEGORY_LOCKED_AFTER_PUBLISH',
        message: 'Cannot change category after first publish',
      });
    }
    const currentSlugNorm = off.slug.trim().toLowerCase();
    if (
      nextSlug != null &&
      nextSlug.length > 0 &&
      !unpublished &&
      nextSlug !== currentSlugNorm
    ) {
      throw new BadRequestException({
        code: 'OFFERING_SLUG_LOCKED_AFTER_PUBLISH',
        message: 'Cannot change slug after first publish',
      });
    }

    if (nextCategoryId != null) {
      const majors = await this.getOrganizationMajorCategoryIds(organizationId);
      await this.assertServiceCategoriesBelongToOrganizationMajors(
        [nextCategoryId],
        majors,
      );
    }
    const bodyZoneCategoryId = nextCategoryId ?? off.categoryId;
    if (body.bodyZoneIds !== undefined || nextCategoryId != null) {
      await this.validateOfferingBodyZones({
        categoryId: bodyZoneCategoryId,
        bodyZoneIds: body.bodyZoneIds ?? [],
      });
    }

    if (nextSlug != null && nextSlug.length > 0) {
      const dup = await this.prisma.organizationOffering.findFirst({
        where: {
          organizationId,
          slug: nextSlug,
          deletedAt: null,
          NOT: { id: offeringId },
        },
        select: { id: true },
      });
      if (dup) {
        throw new ConflictException({
          code: 'OFFERING_SLUG_TAKEN',
          message: 'Slug already in use for this organization',
        });
      }
    }

    const data: Parameters<
      typeof this.prisma.organizationOffering.update
    >[0]['data'] = {};
    if (body.title !== undefined) {
      data.title = body.title.trim();
    }
    if (body.description !== undefined) {
      data.description =
        body.description !== null ? body.description.trim() || null : null;
    }
    if (nextCategoryId != null) {
      data.categoryId = nextCategoryId;
    }
    if (nextSlug != null && nextSlug.length > 0) {
      data.slug = nextSlug;
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.organizationOffering.update({
        where: { id: offeringId },
        data,
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          categoryId: true,
          publicationStatus: true,
          firstPublishedAt: true,
        },
      });
      if (body.bodyZoneIds !== undefined || nextCategoryId != null) {
        await this.replaceOfferingBodyZones(
          tx,
          offeringId,
          body.bodyZoneIds ?? [],
        );
      }
      await this.upsertOfferingLocales(tx, offeringId, body.locales);
      return updated;
    });
    if (body.bodyZoneIds !== undefined || nextCategoryId != null) {
      await this.reconcileListingEdgesForOrganization(organizationId);
    }
    return row;
  }

  async publishOffering(
    userId: string,
    organizationId: string,
    offeringId: string,
  ) {
    await this.assertUserCanManageOrganizationOfferings(userId, organizationId);
    const off = await this.prisma.organizationOffering.findFirst({
      where: { id: offeringId, organizationId, deletedAt: null },
      select: { id: true, firstPublishedAt: true },
    });
    if (!off) {
      throw new NotFoundException({
        code: 'ORGANIZATION_OFFERING_NOT_FOUND',
        message: 'Offering not found',
      });
    }

    const activeOptions = await this.prisma.offeringPriceOption.count({
      where: {
        organizationOfferingId: offeringId,
        deletedAt: null,
        status: OfferingPriceOptionStatus.active,
        currency: 'VND',
      },
    });
    if (activeOptions < 1) {
      throw new BadRequestException({
        code: 'OFFERING_PUBLISH_REQUIRES_PRICE_OPTION',
        message:
          'At least one active VND price option is required before publish',
      });
    }

    const now = new Date();
    const row = await this.prisma.organizationOffering.update({
      where: { id: offeringId },
      data: {
        publicationStatus: OfferingPublicationStatus.published,
        firstPublishedAt: off.firstPublishedAt ?? now,
        lastPublishedAt: now,
      },
      select: {
        id: true,
        publicationStatus: true,
        firstPublishedAt: true,
        lastPublishedAt: true,
      },
    });

    await this.reconcileListingEdgesForOrganization(organizationId);
    await syncOrganizationServiceCategoriesFromPublishedOfferings(
      this.prisma,
      organizationId,
    );

    return row;
  }

  async unpublishOffering(
    userId: string,
    organizationId: string,
    offeringId: string,
  ) {
    await this.assertUserCanManageOrganizationOfferings(userId, organizationId);
    const off = await this.prisma.organizationOffering.findFirst({
      where: { id: offeringId, organizationId, deletedAt: null },
      select: { id: true, publicationStatus: true },
    });
    if (!off) {
      throw new NotFoundException({
        code: 'ORGANIZATION_OFFERING_NOT_FOUND',
        message: 'Offering not found',
      });
    }
    if (off.publicationStatus !== OfferingPublicationStatus.published) {
      throw new BadRequestException({
        code: 'OFFERING_UNPUBLISH_REQUIRES_PUBLISHED',
        message: 'Only published offerings can be unpublished',
      });
    }

    const row = await this.prisma.organizationOffering.update({
      where: { id: offeringId },
      data: { publicationStatus: OfferingPublicationStatus.hidden },
      select: {
        id: true,
        publicationStatus: true,
        firstPublishedAt: true,
        lastPublishedAt: true,
      },
    });

    await this.reconcileListingEdgesForOrganization(organizationId);
    await syncOrganizationServiceCategoriesFromPublishedOfferings(
      this.prisma,
      organizationId,
    );

    return row;
  }

  /**
   * Мягкое удаление оффера: скрыт из кабинета/витрины, строка в БД сохраняется для FK броней и снимков.
   */
  async deleteOffering(
    userId: string,
    organizationId: string,
    offeringId: string,
  ): Promise<void> {
    await this.assertUserCanManageOrganizationOfferings(userId, organizationId);
    const off = await this.prisma.organizationOffering.findFirst({
      where: { id: offeringId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!off) {
      throw new NotFoundException({
        code: 'ORGANIZATION_OFFERING_NOT_FOUND',
        message: 'Offering not found',
      });
    }

    const activeBookings = await this.prisma.booking.count({
      where: {
        organizationOfferingId: offeringId,
        deletedAt: null,
        status: {
          in: [
            BookingStatus.pending,
            BookingStatus.confirmed,
            BookingStatus.in_progress,
          ],
        },
      },
    });
    if (activeBookings > 0) {
      throw new BadRequestException({
        code: 'OFFERING_DELETE_BLOCKED_ACTIVE_BOOKINGS',
        message:
          'Cannot delete offering while it has pending, confirmed, or in-progress bookings',
      });
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.offeringPriceOption.updateMany({
        where: { organizationOfferingId: offeringId, deletedAt: null },
        data: {
          deletedAt: now,
          status: OfferingPriceOptionStatus.archived,
        },
      });
      await tx.specialistOffering.updateMany({
        where: {
          organizationOfferingId: offeringId,
          deletedAt: null,
        },
        data: {
          status: SpecialistOfferingStatus.removed,
          deletedAt: now,
        },
      });
      await tx.organizationOffering.update({
        where: { id: offeringId },
        data: {
          deletedAt: now,
          publicationStatus: OfferingPublicationStatus.hidden,
        },
      });
    });

    await this.reconcileListingEdgesForOrganization(organizationId);
    await syncOrganizationServiceCategoriesFromPublishedOfferings(
      this.prisma,
      organizationId,
    );
  }

  async createOfferingPriceOption(
    userId: string,
    organizationId: string,
    offeringId: string,
    body: PostOfferingPriceOptionBody,
  ) {
    await this.assertUserCanManageOrganizationOfferings(userId, organizationId);
    const exists = await this.prisma.organizationOffering.findFirst({
      where: { id: offeringId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException({
        code: 'ORGANIZATION_OFFERING_NOT_FOUND',
        message: 'Offering not found',
      });
    }
    const dup = await this.prisma.offeringPriceOption.findFirst({
      where: {
        organizationOfferingId: offeringId,
        durationMinutes: body.durationMinutes,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (dup) {
      throw new ConflictException({
        code: 'OFFERING_PRICE_OPTION_DURATION_DUPLICATE',
        message: 'A price option with this duration already exists',
      });
    }

    const row = await this.prisma.offeringPriceOption.create({
      data: {
        organizationOfferingId: offeringId,
        durationMinutes: body.durationMinutes,
        priceAmount: body.priceAmount,
        currency: (body.currency?.trim().toUpperCase() || 'VND') ?? 'VND',
        status: OfferingPriceOptionStatus.active,
      },
      select: {
        id: true,
        durationMinutes: true,
        priceAmount: true,
        currency: true,
        status: true,
      },
    });
    await this.reconcileListingEdgesForOrganization(organizationId);
    return row;
  }

  async patchOfferingPriceOption(
    userId: string,
    organizationId: string,
    offeringId: string,
    optionId: string,
    body: PatchOfferingPriceOptionBody,
  ) {
    await this.assertUserCanManageOrganizationOfferings(userId, organizationId);

    const option = await this.prisma.offeringPriceOption.findFirst({
      where: {
        id: optionId,
        organizationOfferingId: offeringId,
        organizationOffering: { organizationId, deletedAt: null },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!option) {
      throw new NotFoundException({
        code: 'OFFERING_PRICE_OPTION_NOT_FOUND',
        message: 'Price option not found',
      });
    }

    const data: Parameters<
      typeof this.prisma.offeringPriceOption.update
    >[0]['data'] = {};
    if (body.status !== undefined) {
      data.status = body.status;
    }
    if (body.priceAmount !== undefined) {
      data.priceAmount = body.priceAmount;
    }
    if (body.remove === true) {
      data.deletedAt = new Date();
      data.status = OfferingPriceOptionStatus.archived;
    }

    const row = await this.prisma.offeringPriceOption.update({
      where: { id: optionId },
      data,
      select: {
        id: true,
        durationMinutes: true,
        priceAmount: true,
        currency: true,
        status: true,
        deletedAt: true,
      },
    });
    await this.reconcileListingEdgesForOrganization(organizationId);
    return row;
  }

  async createSpecialistOfferingAssignment(
    userId: string,
    organizationId: string,
    offeringId: string,
    specialistId: string,
  ) {
    await this.assertUserCanManageOrganizationOfferings(userId, organizationId);
    const off = await this.prisma.organizationOffering.findFirst({
      where: { id: offeringId, organizationId, deletedAt: null },
      select: { id: true, categoryId: true },
    });
    if (!off) {
      throw new NotFoundException({
        code: 'ORGANIZATION_OFFERING_NOT_FOUND',
        message: 'Offering not found',
      });
    }
    await this.ensureSpecialistEmployedAtOrganization({
      organizationId,
      specialistId,
    });
    await this.assertSpecialistHasOfferingSkill({
      specialistId,
      categoryId: off.categoryId,
    });

    const existing = await this.prisma.specialistOffering.findUnique({
      where: {
        specialistId_organizationOfferingId: {
          specialistId,
          organizationOfferingId: offeringId,
        },
      },
      select: { id: true, deletedAt: true, status: true },
    });

    if (
      existing &&
      existing.deletedAt == null &&
      existing.status !== SpecialistOfferingStatus.removed
    ) {
      throw new ConflictException({
        code: 'SPECIALIST_OFFERING_ASSIGNMENT_EXISTS',
        message: 'Specialist is already assigned to this offering',
      });
    }

    const row =
      existing != null
        ? await this.prisma.specialistOffering.update({
            where: { id: existing.id },
            data: {
              deletedAt: null,
              status: SpecialistOfferingStatus.active,
            },
            select: {
              id: true,
              specialistId: true,
              status: true,
            },
          })
        : await this.prisma.specialistOffering.create({
            data: {
              specialistId,
              organizationOfferingId: offeringId,
              status: SpecialistOfferingStatus.active,
            },
            select: {
              id: true,
              specialistId: true,
              status: true,
            },
          });

    await this.refreshEdgesForSpecialist(specialistId);
    return row;
  }

  async patchSpecialistOfferingAssignment(
    userId: string,
    organizationId: string,
    offeringId: string,
    assignmentId: string,
    body: PatchSpecialistOfferingAssignmentBody,
  ) {
    await this.assertUserCanManageOrganizationOfferings(userId, organizationId);
    const row = await this.prisma.specialistOffering.findFirst({
      where: {
        id: assignmentId,
        organizationOfferingId: offeringId,
        organizationOffering: { organizationId, deletedAt: null },
        deletedAt: null,
      },
      select: { id: true, specialistId: true },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'SPECIALIST_OFFERING_ASSIGNMENT_NOT_FOUND',
        message: 'Assignment not found',
      });
    }

    const now = new Date();
    const nextStatus = body.status;
    const updated = await this.prisma.specialistOffering.update({
      where: { id: assignmentId },
      data: {
        status: nextStatus,
        deletedAt:
          nextStatus === SpecialistOfferingStatus.removed ? now : null,
      },
      select: {
        id: true,
        specialistId: true,
        status: true,
      },
    });
    await this.refreshEdgesForSpecialist(row.specialistId);
    return updated;
  }

  async createSpecialistOfferingPriceOverride(
    userId: string,
    organizationId: string,
    offeringId: string,
    assignmentId: string,
    body: PostSpecialistOfferingPriceOverrideBody,
  ) {
    await this.assertUserCanManageOrganizationOfferings(userId, organizationId);
    const assign = await this.prisma.specialistOffering.findFirst({
      where: {
        id: assignmentId,
        organizationOfferingId: offeringId,
        organizationOffering: { organizationId, deletedAt: null },
        deletedAt: null,
      },
      select: { id: true, specialistId: true },
    });
    if (!assign) {
      throw new NotFoundException({
        code: 'SPECIALIST_OFFERING_ASSIGNMENT_NOT_FOUND',
        message: 'Assignment not found',
      });
    }

    const opt = await this.prisma.offeringPriceOption.findFirst({
      where: {
        id: body.offeringPriceOptionId,
        organizationOfferingId: offeringId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!opt) {
      throw new BadRequestException({
        code: 'OFFERING_PRICE_OPTION_NOT_IN_OFFERING',
        message: 'Price option does not belong to this offering',
      });
    }

    const row = await this.prisma.specialistOfferingPriceOverride.upsert({
      where: {
        specialistOfferingId_offeringPriceOptionId: {
          specialistOfferingId: assignmentId,
          offeringPriceOptionId: body.offeringPriceOptionId,
        },
      },
      create: {
        specialistOfferingId: assignmentId,
        offeringPriceOptionId: body.offeringPriceOptionId,
        customPrice: body.customPrice,
      },
      update: { customPrice: body.customPrice },
      select: {
        id: true,
        offeringPriceOptionId: true,
        customPrice: true,
      },
    });

    await this.refreshEdgesForSpecialist(assign.specialistId);
    return row;
  }

  async patchSpecialistOfferingPriceOverride(
    userId: string,
    organizationId: string,
    offeringId: string,
    assignmentId: string,
    overrideId: string,
    body: PatchSpecialistOfferingPriceOverrideBody,
  ) {
    await this.assertUserCanManageOrganizationOfferings(userId, organizationId);

    const ovr = await this.prisma.specialistOfferingPriceOverride.findFirst({
      where: {
        id: overrideId,
        specialistOfferingId: assignmentId,
        specialistOffering: {
          id: assignmentId,
          organizationOfferingId: offeringId,
          organizationOffering: { organizationId, deletedAt: null },
        },
      },
      select: {
        id: true,
        specialistOffering: { select: { specialistId: true } },
      },
    });
    if (!ovr) {
      throw new NotFoundException({
        code: 'SPECIALIST_OFFERING_PRICE_OVERRIDE_NOT_FOUND',
        message: 'Price override not found',
      });
    }

    const row = await this.prisma.specialistOfferingPriceOverride.update({
      where: { id: overrideId },
      data: { customPrice: body.customPrice },
      select: {
        id: true,
        offeringPriceOptionId: true,
        customPrice: true,
      },
    });

    await this.refreshEdgesForSpecialist(ovr.specialistOffering.specialistId);
    return row;
  }

  async deleteSpecialistOfferingPriceOverride(
    userId: string,
    organizationId: string,
    offeringId: string,
    assignmentId: string,
    overrideId: string,
  ): Promise<void> {
    await this.assertUserCanManageOrganizationOfferings(userId, organizationId);

    const ovr = await this.prisma.specialistOfferingPriceOverride.findFirst({
      where: {
        id: overrideId,
        specialistOfferingId: assignmentId,
        specialistOffering: {
          id: assignmentId,
          organizationOfferingId: offeringId,
          organizationOffering: { organizationId, deletedAt: null },
        },
      },
      select: {
        specialistOffering: { select: { specialistId: true } },
      },
    });
    if (!ovr) {
      throw new NotFoundException({
        code: 'SPECIALIST_OFFERING_PRICE_OVERRIDE_NOT_FOUND',
        message: 'Price override not found',
      });
    }

    await this.prisma.specialistOfferingPriceOverride.delete({
      where: { id: overrideId },
    });
    await this.refreshEdgesForSpecialist(ovr.specialistOffering.specialistId);
  }
}
