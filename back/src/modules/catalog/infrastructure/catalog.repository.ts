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

const majorServiceCategoryListInclude = {
  locales: true,
} satisfies Prisma.MajorServiceCategoryInclude;

export type MajorServiceCategoryListItem =
  Prisma.MajorServiceCategoryGetPayload<{
    include: typeof majorServiceCategoryListInclude;
  }>;

@Injectable()
export class CatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Все активные большие категории с локалями (без подкатегорий), по `sortOrder`.
   */
  async findAllMajorServiceCategories(): Promise<
    MajorServiceCategoryListItem[]
  > {
    return this.prisma.majorServiceCategory.findMany({
      where: {
        deletedAt: null,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
      include: majorServiceCategoryListInclude,
    });
  }

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
