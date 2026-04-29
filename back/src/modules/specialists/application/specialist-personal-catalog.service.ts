import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { syncOrganizationServiceCategoriesFromSpecialistServices } from '../../organizations/infrastructure/organization-service-category-sync';
import type { ApiLocale } from '../../../common/i18n';
import type { CreateSpecialistPersonalServiceBody } from '../dto/specialist-body.schema';

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
    });
    if (!category) {
      throw new BadRequestException({
        code: 'SERVICE_CATEGORY_NOT_FOUND',
        message: 'Category not found or inactive',
      });
    }
    const serviceId = await this.prisma.$transaction(async (tx) => {
      const id = randomUUID();
      const slug = makeServiceSlug(category.slug, id);
      await tx.service.create({
        data: {
          id,
          organizationId: null,
          specialistId: specialist.id,
          categoryId: body.categoryId,
          slug,
          description: body.description ?? null,
        },
      });
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
   * Мягкое удаление личной услуги (`organizationId` = null). Услуги каталога салона — не трогаем.
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
          organizationId: null,
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
          organizationId: null,
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
}
