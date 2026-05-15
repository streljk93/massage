import { Injectable, NotFoundException } from '@nestjs/common';
import type { ApiLocale } from '../../../common/i18n';
import {
  pickLocalizedMajorName,
  pickLocalizedServiceCategoryFields,
  type CategoryLocaleShape,
} from '../../../common/i18n';
import type {
  CatalogBulkCategoriesResponseDto,
  CatalogBodyZonesResponseDto,
  CatalogCategoriesResponseDto,
} from '../dto/catalog-categories-response.dto';
import type { CatalogCategoryDetailResponseDto } from '../dto/catalog-category-detail-response.dto';
import type { CatalogMajorCategoriesListResponseDto } from '../dto/catalog-major-categories-list-response.dto';
import { CatalogRepository } from '../infrastructure/catalog.repository';

@Injectable()
export class CatalogService {
  constructor(private readonly catalogRepository: CatalogRepository) {}

  async getAllMajorServiceCategories(
    locale: ApiLocale,
  ): Promise<CatalogMajorCategoriesListResponseDto> {
    const rows = await this.catalogRepository.findAllMajorServiceCategories();
    return {
      majorCategories: rows.map((row) => ({
        id: row.id,
        name: pickLocalizedMajorName(row, locale),
        slug: row.slug,
        sortOrder: row.sortOrder,
      })),
    };
  }

  async getServiceCategoriesByMajorSlug(
    majorSlug: string,
    locale: ApiLocale,
    options?: { listedInDirectory?: boolean },
  ): Promise<CatalogCategoriesResponseDto> {
    const row =
      await this.catalogRepository.findServiceCategoriesByMajorSlug(majorSlug);

    if (!row) {
      throw new NotFoundException({
        code: 'MAJOR_CATEGORY_NOT_FOUND',
        message: `Major service category not found: ${majorSlug}`,
      });
    }

    let categories = row.categories;
    if (options?.listedInDirectory) {
      const allowed = new Set(
        await this.catalogRepository.findDirectoryListingServiceCategoryIdsForMajorSlug(
          majorSlug,
        ),
      );
      categories = row.categories.filter((c) => allowed.has(c.id));
    }

    return {
      majorCategory: {
        id: row.id,
        name: pickLocalizedMajorName(row, locale),
        slug: row.slug,
      },
      categories: categories.map((c) =>
        pickLocalizedServiceCategoryFields(
          c as unknown as CategoryLocaleShape,
          locale,
        ),
      ),
    };
  }

  async getServiceCategoriesByMajorSlugsBulk(
    majorSlugs: string[],
    locale: ApiLocale,
    options?: { listedInDirectory?: boolean },
  ): Promise<CatalogBulkCategoriesResponseDto> {
    const sections: CatalogCategoriesResponseDto[] = [];
    for (const slug of majorSlugs) {
      sections.push(
        await this.getServiceCategoriesByMajorSlug(slug, locale, options),
      );
    }
    return { sections };
  }

  async getServiceCategoryByMajorAndSlug(
    majorSlug: string,
    categorySlug: string,
    locale: ApiLocale,
  ): Promise<CatalogCategoryDetailResponseDto> {
    const row =
      await this.catalogRepository.findServiceCategoryByMajorAndCategorySlugs(
        majorSlug,
        categorySlug,
      );

    if (!row) {
      throw new NotFoundException({
        code: 'SERVICE_CATEGORY_NOT_FOUND',
        message: `Service category not found: ${majorSlug}/${categorySlug}`,
      });
    }

    const major = row.majorServiceCategory;

    return {
      majorCategory: {
        id: major.id,
        name: pickLocalizedMajorName(major, locale),
        slug: major.slug,
      },
      category: pickLocalizedServiceCategoryFields(
        row as unknown as CategoryLocaleShape,
        locale,
      ),
    };
  }

  async getBodyZonesByMajorSlug(
    majorSlug: string,
    locale: ApiLocale,
  ): Promise<CatalogBodyZonesResponseDto> {
    const row = await this.catalogRepository.findBodyZonesByMajorSlug(majorSlug);
    if (!row) {
      throw new NotFoundException({
        code: 'MAJOR_CATEGORY_NOT_FOUND',
        message: `Major service category not found: ${majorSlug}`,
      });
    }
    return {
      majorCategory: {
        id: row.id,
        name: pickLocalizedMajorName(row, locale),
        slug: row.slug,
      },
      bodyZones: row.bodyZones.map((z) => ({
        id: z.id,
        slug: z.slug,
        name:
          z.locales.find((l) => l.locale === locale)?.name?.trim() ||
          z.locales.find((l) => l.locale === 'en')?.name?.trim() ||
          z.slug,
        sortOrder: z.sortOrder,
      })),
    };
  }
}
