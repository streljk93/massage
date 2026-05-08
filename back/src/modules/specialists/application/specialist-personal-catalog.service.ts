import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ServiceCatalogScope } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { syncOrganizationServiceCategoriesFromSpecialistServices } from '../../organizations/infrastructure/organization-service-category-sync';
import type { ApiLocale } from '../../../common/i18n';
import type { CreateSpecialistPersonalServiceBody } from '../dto/specialist-body.schema';
import {
  getAllowedBodyZoneSlugsForCategories,
  isBodyZoneApplicableForMajor,
} from '../domain/body-zone-compatibility';

function makeServiceSlug(categorySlug: string, id: string): string {
  const base = categorySlug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${base || 'service'}-${id.slice(0, 8)}`;
}

@Injectable()
export class SpecialistPersonalCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeBodyZoneSlugs(rawSlugs: string[] | undefined): string[] {
    const unique = [...new Set(rawSlugs ?? [])];
    if (unique.includes('full-body')) {
      return ['full-body'];
    }
    return unique;
  }

  private async resolveValidatedBodyZones(args: {
    majorSlug: string;
    categorySlugs: string[];
    bodyZoneSlugs: string[];
  }): Promise<Array<{ id: string; slug: string }>> {
    if (args.bodyZoneSlugs.length === 0) {
      return [];
    }
    if (!isBodyZoneApplicableForMajor(args.majorSlug)) {
      throw new BadRequestException({
        code: 'BODY_ZONES_NOT_APPLICABLE_FOR_MAJOR',
        message: `Body zones are not supported for major category ${args.majorSlug}`,
      });
    }
    const allowed = getAllowedBodyZoneSlugsForCategories({
      majorSlug: args.majorSlug,
      categorySlugs: args.categorySlugs,
    });
    if (allowed.length === 0) {
      throw new BadRequestException({
        code: 'BODY_ZONES_NOT_ALLOWED_FOR_CATEGORY',
        message: 'Body zones are not allowed for this service category',
      });
    }
    const allowedSet = new Set(allowed);
    const invalidInput = args.bodyZoneSlugs.find((slug) => !allowedSet.has(slug));
    if (invalidInput != null) {
      throw new BadRequestException({
        code: 'BODY_ZONES_NOT_ALLOWED_FOR_CATEGORY',
        message: `Body zone ${invalidInput} is not allowed for selected categories`,
      });
    }
    const bodyZones = await this.prisma.bodyZone.findMany({
      where: {
        slug: { in: args.bodyZoneSlugs },
        deletedAt: null,
        isActive: true,
        majorServiceCategory: {
          slug: args.majorSlug,
          deletedAt: null,
          isActive: true,
        },
      },
      select: { id: true, slug: true },
    });
    if (bodyZones.length !== args.bodyZoneSlugs.length) {
      throw new BadRequestException({
        code: 'INVALID_BODY_ZONES',
        message: 'One or more body zones are invalid',
      });
    }
    return bodyZones;
  }

  async createPersonalService(
    userId: string,
    body: CreateSpecialistPersonalServiceBody,
    _locale: ApiLocale,
  ): Promise<{ serviceId: string }> {
    void _locale;
    const specialist = await this.prisma.specialist.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true, activeOrganizationId: true },
    });
    if (!specialist) {
      throw new NotFoundException({
        code: 'SPECIALIST_PROFILE_NOT_FOUND',
        message: 'Specialist profile not found for this user',
      });
    }
    const category = await this.prisma.serviceCategory.findFirst({
      where: { id: body.categoryId, deletedAt: null, isActive: true },
      include: {
        majorServiceCategory: { select: { slug: true } },
      },
    });
    if (!category) {
      throw new BadRequestException({
        code: 'SERVICE_CATEGORY_NOT_FOUND',
        message: 'Category not found or inactive',
      });
    }
    const kind = body.kind ?? 'standard';
    const comboCategoryIds = [...new Set(body.comboCategoryIds ?? [])];
    let comboRows: Array<{ id: string; slug: string; majorServiceCategoryId: string }> = [];
    if (kind === 'combo' && comboCategoryIds.length > 0) {
      comboRows = await this.prisma.serviceCategory.findMany({
        where: { id: { in: comboCategoryIds }, deletedAt: null, isActive: true },
        select: { id: true, slug: true, majorServiceCategoryId: true },
      });
      if (comboRows.length !== comboCategoryIds.length) {
        throw new BadRequestException({
          code: 'INVALID_COMBO_CATEGORIES',
          message: 'One or more combo categories are invalid',
        });
      }
      const hasMajorMismatch = comboRows.some(
        (row) => row.majorServiceCategoryId !== category.majorServiceCategoryId,
      );
      if (hasMajorMismatch) {
        throw new BadRequestException({
          code: 'INVALID_COMBO_CATEGORIES_MAJOR_MISMATCH',
          message: 'Combo categories must belong to the same major category',
        });
      }
    }
    const bodyZoneSlugs = this.normalizeBodyZoneSlugs(body.bodyZoneSlugs);
    const bodyZones = await this.resolveValidatedBodyZones({
      majorSlug: category.majorServiceCategory.slug,
      categorySlugs: [
        category.slug,
        ...(kind === 'combo' ? comboRows.map((row) => row.slug) : []),
      ],
      bodyZoneSlugs,
    });
    const serviceId = await this.prisma.$transaction(async (tx) => {
      const id = randomUUID();
      const slug = makeServiceSlug(category.slug, id);
      await tx.service.create({
        data: {
          id,
          organizationId: null,
          scope: ServiceCatalogScope.personal,
          specialistId: specialist.id,
          categoryId: body.categoryId,
          kind,
          slug,
          description: body.description ?? null,
        },
      });
      if (kind === 'combo') {
        for (let i = 0; i < comboCategoryIds.length; i += 1) {
          await tx.serviceComboItem.create({
            data: {
              comboServiceId: id,
              itemServiceCategoryId: comboCategoryIds[i]!,
              sortOrder: i,
            },
          });
        }
      }
      for (const z of bodyZones) {
        await tx.serviceBodyZone.create({
          data: {
            serviceId: id,
            bodyZoneId: z.id,
          },
        });
      }
      for (const opt of body.priceOptions) {
        const currency = opt.currency ?? 'VND';
        await tx.servicePriceOption.create({
          data: {
            serviceId: id,
            durationMinutes: opt.durationMinutes,
            priceAmount: opt.priceAmount,
            currency,
          },
        });
      }
      /**
       * Витрина / GET /specialists с `majorSlug` фильтрует по `SpecialistServiceCategory`,
       * а не только по `Service.categoryId`. Без строки здесь мастер не попадает в поиск.
       */
      await tx.specialistServiceCategory.upsert({
        where: {
          specialistId_serviceCategoryId: {
            specialistId: specialist.id,
            serviceCategoryId: body.categoryId,
          },
        },
        create: {
          specialistId: specialist.id,
          serviceCategoryId: body.categoryId,
        },
        update: {},
      });
      if (specialist.activeOrganizationId != null) {
        await syncOrganizationServiceCategoriesFromSpecialistServices(
          tx,
          specialist.activeOrganizationId,
        );
      }
      return id;
    });
    return { serviceId: serviceId };
  }

  /**
   * Мягкое удаление строки личной услуги (`ServiceCatalogScope.personal`). Строки каталога организации не затрагиваются.
   */
  async deletePersonalService(
    userId: string,
    serviceId: string,
  ): Promise<{ ok: true }> {
    const specialist = await this.prisma.specialist.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true, activeOrganizationId: true },
    });
    if (!specialist) {
      throw new NotFoundException({
        code: 'SPECIALIST_PROFILE_NOT_FOUND',
        message: 'Specialist profile not found for this user',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const svc = await tx.service.findFirst({
        where: {
          id: serviceId,
          specialistId: specialist.id,
          scope: ServiceCatalogScope.personal,
          deletedAt: null,
        },
        select: { id: true, categoryId: true },
      });
      if (!svc) {
        throw new NotFoundException({
          code: 'SERVICE_NOT_FOUND',
          message: 'Personal service not found or already deleted',
        });
      }

      await tx.service.update({
        where: { id: svc.id },
        data: { deletedAt: new Date() },
      });

      const remaining = await tx.service.count({
        where: {
          specialistId: specialist.id,
          categoryId: svc.categoryId,
          scope: ServiceCatalogScope.personal,
          deletedAt: null,
        },
      });
      if (remaining === 0) {
        await tx.specialistServiceCategory.deleteMany({
          where: {
            specialistId: specialist.id,
            serviceCategoryId: svc.categoryId,
          },
        });
      }

      if (specialist.activeOrganizationId != null) {
        await syncOrganizationServiceCategoriesFromSpecialistServices(
          tx,
          specialist.activeOrganizationId,
        );
      }
    });

    return { ok: true as const };
  }

  /**
   * Обновление личной услуги: категория, описание и полный набор вариантов цены/длительности.
   * Идентификатор услуги не меняется (важно для уже созданных броней).
   */
  async updatePersonalService(
    userId: string,
    serviceId: string,
    body: CreateSpecialistPersonalServiceBody,
    _locale: ApiLocale,
  ): Promise<{ serviceId: string }> {
    void _locale;
    const specialist = await this.prisma.specialist.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true, activeOrganizationId: true },
    });
    if (!specialist) {
      throw new NotFoundException({
        code: 'SPECIALIST_PROFILE_NOT_FOUND',
        message: 'Specialist profile not found for this user',
      });
    }

    const category = await this.prisma.serviceCategory.findFirst({
      where: { id: body.categoryId, deletedAt: null, isActive: true },
      include: {
        majorServiceCategory: { select: { slug: true } },
      },
    });
    if (!category) {
      throw new BadRequestException({
        code: 'SERVICE_CATEGORY_NOT_FOUND',
        message: 'Category not found or inactive',
      });
    }
    const kind = body.kind ?? 'standard';
    const comboCategoryIds = [...new Set(body.comboCategoryIds ?? [])];
    let comboRows: Array<{ id: string; slug: string; majorServiceCategoryId: string }> = [];
    if (kind === 'combo' && comboCategoryIds.length > 0) {
      comboRows = await this.prisma.serviceCategory.findMany({
        where: { id: { in: comboCategoryIds }, deletedAt: null, isActive: true },
        select: { id: true, slug: true, majorServiceCategoryId: true },
      });
      if (comboRows.length !== comboCategoryIds.length) {
        throw new BadRequestException({
          code: 'INVALID_COMBO_CATEGORIES',
          message: 'One or more combo categories are invalid',
        });
      }
      const hasMajorMismatch = comboRows.some(
        (row) => row.majorServiceCategoryId !== category.majorServiceCategoryId,
      );
      if (hasMajorMismatch) {
        throw new BadRequestException({
          code: 'INVALID_COMBO_CATEGORIES_MAJOR_MISMATCH',
          message: 'Combo categories must belong to the same major category',
        });
      }
    }
    const bodyZoneSlugs = this.normalizeBodyZoneSlugs(body.bodyZoneSlugs);
    const bodyZones = await this.resolveValidatedBodyZones({
      majorSlug: category.majorServiceCategory.slug,
      categorySlugs: [
        category.slug,
        ...(kind === 'combo' ? comboRows.map((row) => row.slug) : []),
      ],
      bodyZoneSlugs,
    });

    await this.prisma.$transaction(async (tx) => {
      const svc = await tx.service.findFirst({
        where: {
          id: serviceId,
          specialistId: specialist.id,
          scope: ServiceCatalogScope.personal,
          deletedAt: null,
        },
        select: { id: true, categoryId: true },
      });
      if (!svc) {
        throw new NotFoundException({
          code: 'SERVICE_NOT_FOUND',
          message: 'Personal service not found or already deleted',
        });
      }

      const oldCategoryId = svc.categoryId;
      const newCategoryId = body.categoryId;
      const newSlug =
        oldCategoryId === newCategoryId
          ? undefined
          : makeServiceSlug(category.slug, svc.id);

      await tx.service.update({
        where: { id: svc.id },
        data: {
          categoryId: newCategoryId,
          kind,
          ...(newSlug != null ? { slug: newSlug } : {}),
          description: body.description ?? null,
        },
      });
      await tx.serviceComboItem.deleteMany({
        where: { comboServiceId: svc.id },
      });
      if (kind === 'combo') {
        for (let i = 0; i < comboCategoryIds.length; i += 1) {
          await tx.serviceComboItem.create({
            data: {
              comboServiceId: svc.id,
              itemServiceCategoryId: comboCategoryIds[i]!,
              sortOrder: i,
            },
          });
        }
      }
      await tx.serviceBodyZone.deleteMany({
        where: { serviceId: svc.id },
      });
      for (const z of bodyZones) {
        await tx.serviceBodyZone.create({
          data: {
            serviceId: svc.id,
            bodyZoneId: z.id,
          },
        });
      }

      await tx.servicePriceOption.deleteMany({
        where: { serviceId: svc.id },
      });
      for (const opt of body.priceOptions) {
        const currency = opt.currency ?? 'VND';
        await tx.servicePriceOption.create({
          data: {
            serviceId: svc.id,
            durationMinutes: opt.durationMinutes,
            priceAmount: opt.priceAmount,
            currency,
          },
        });
      }

      if (oldCategoryId !== newCategoryId) {
        const remainingOld = await tx.service.count({
          where: {
            specialistId: specialist.id,
            categoryId: oldCategoryId,
            scope: ServiceCatalogScope.personal,
            deletedAt: null,
          },
        });
        if (remainingOld === 0) {
          await tx.specialistServiceCategory.deleteMany({
            where: {
              specialistId: specialist.id,
              serviceCategoryId: oldCategoryId,
            },
          });
        }
        await tx.specialistServiceCategory.upsert({
          where: {
            specialistId_serviceCategoryId: {
              specialistId: specialist.id,
              serviceCategoryId: newCategoryId,
            },
          },
          create: {
            specialistId: specialist.id,
            serviceCategoryId: newCategoryId,
          },
          update: {},
        });
      }

      if (specialist.activeOrganizationId != null) {
        await syncOrganizationServiceCategoriesFromSpecialistServices(
          tx,
          specialist.activeOrganizationId,
        );
      }
    });

    return { serviceId };
  }
}
