import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

/** Запрос каталога с подгруженными строками локалей (тип для сервиса). */
export const catalogMajorWithLocalesArgs = {
  include: {
    locales: true,
    categories: {
      where: {
        deletedAt: null,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' as const },
      include: {
        locales: true,
      },
    },
  },
} satisfies Prisma.MajorServiceCategoryFindFirstArgs;

export type MajorServiceCategoryWithLocales = NonNullable<
  Prisma.MajorServiceCategoryGetPayload<typeof catalogMajorWithLocalesArgs>
>;

/** Одна подкатегория с локалями и родительской большой категорией с локалями. */
export const serviceCategoryWithMajorLocalesArgs = {
  include: {
    locales: true,
    majorServiceCategory: {
      include: {
        locales: true,
      },
    },
  },
} satisfies Prisma.ServiceCategoryFindFirstArgs;

export type ServiceCategoryWithMajorAndLocales = NonNullable<
  Prisma.ServiceCategoryGetPayload<typeof serviceCategoryWithMajorLocalesArgs>
>;

@Injectable()
export class CatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Активная большая категория по slug, подкатегории и все строки локалей (разрешение на сервисе).
   */
  async findServiceCategoriesByMajorSlug(
    majorSlug: string,
  ): Promise<MajorServiceCategoryWithLocales | null> {
    return this.prisma.majorServiceCategory.findFirst({
      where: {
        slug: majorSlug,
        deletedAt: null,
        isActive: true,
      },
      ...catalogMajorWithLocalesArgs,
    });
  }

  /**
   * Активная подкатегория по slug внутри активной большой категории с тем же slug.
   */
  async findServiceCategoryByMajorAndCategorySlugs(
    majorSlug: string,
    categorySlug: string,
  ): Promise<ServiceCategoryWithMajorAndLocales | null> {
    return this.prisma.serviceCategory.findFirst({
      where: {
        slug: categorySlug,
        deletedAt: null,
        isActive: true,
        majorServiceCategory: {
          slug: majorSlug,
          deletedAt: null,
          isActive: true,
        },
      },
      ...serviceCategoryWithMajorLocalesArgs,
    });
  }
}
