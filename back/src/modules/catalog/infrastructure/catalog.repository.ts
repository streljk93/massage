import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class CatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Активная большая категория по slug и её подкатегории (активные, не удалённые), по sortOrder.
   */
  async findServiceCategoriesByMajorSlug(majorSlug: string) {
    return this.prisma.majorServiceCategory.findFirst({
      where: {
        slug: majorSlug,
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        categories: {
          where: {
            deletedAt: null,
            isActive: true,
          },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            shortName: true,
            slug: true,
            description: true,
            sortOrder: true,
          },
        },
      },
    });
  }
}
