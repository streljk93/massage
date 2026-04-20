import { Injectable, NotFoundException } from '@nestjs/common';
import type { CatalogCategoriesResponseDto } from '../dto/catalog-categories-response.dto';
import { CatalogRepository } from '../infrastructure/catalog.repository';

@Injectable()
export class CatalogService {
  constructor(private readonly catalogRepository: CatalogRepository) {}

  async getServiceCategoriesByMajorSlug(
    majorSlug: string,
  ): Promise<CatalogCategoriesResponseDto> {
    const row =
      await this.catalogRepository.findServiceCategoriesByMajorSlug(majorSlug);

    if (!row) {
      throw new NotFoundException({
        code: 'MAJOR_CATEGORY_NOT_FOUND',
        message: `Major service category not found: ${majorSlug}`,
      });
    }

    return {
      majorCategory: {
        id: row.id,
        name: row.name,
        slug: row.slug,
      },
      categories: row.categories,
    };
  }
}
