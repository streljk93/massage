import { Inject, Injectable, Logger } from '@nestjs/common';
import { OfferingPriceOptionStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { SEARCH_ENGINE } from '../../../infrastructure/search/search-engine.port';
import type { SearchEngine } from '../../../infrastructure/search/search-engine.port';
import type { ApiLocale } from '../../../common/i18n';
import type { DirectoryListSort } from '../../../common/pagination/directory-list-sort';
import type { DirectoryListRadiusFilter } from '../../../common/pagination/directory-list-radius-filter';
import type { SpecialistListApiFilters } from '../infrastructure/directory-list-query-filters';
import { queryOrganizationStorefrontCategoryPairs } from '../infrastructure/organization-vitrine-category-coverage';
import { DirectoryRepository } from '../infrastructure/directory.repository';
import {
  buildMarketplaceListingEdgeDocument,
  type ListingEdgeSourceRow,
} from '../lib/build-marketplace-listing-edge-document';

/** Индекс рёбер `SpecialistOffering` для `GET /v1/specialists` без модели Service (ADR §3). */
@Injectable()
export class MarketplaceListingEdgesIndexService {
  private readonly log = new Logger(MarketplaceListingEdgesIndexService.name);

  constructor(
    @Inject(SEARCH_ENGINE) private readonly search: SearchEngine,
    private readonly directoryRepository: DirectoryRepository,
    private readonly prisma: PrismaService,
  ) {}

  sortByForGroupedSearch(sort: DirectoryListSort): string {
    switch (sort) {
      case 'popularity':
        return 'specialistReviewsCount:desc,specialistRatingAverage:desc,listingEdgeSortKey:asc';
      case 'newest':
        return 'specialistCreatedAtUnix:desc,specialistId:desc,listingEdgeSortKey:asc';
      case 'rating':
        return 'specialistRatingAverage:desc,specialistReviewsCount:desc,listingEdgeSortKey:asc';
      case 'price_asc':
        return 'minPriceVnd:asc,listingEdgeSortKey:asc';
      case 'price_desc':
        return 'minPriceVnd:desc,listingEdgeSortKey:asc';
      default:
        return 'specialistReviewsCount:desc,specialistRatingAverage:desc,listingEdgeSortKey:asc';
    }
  }

  buildFilterBy(args: {
    filters: SpecialistListApiFilters | null;
    radius: DirectoryListRadiusFilter | null;
  }): string {
    const parts: string[] = ['listedInDirectory:=true'];
    const f = args.filters;
    if (f != null) {
      const major = f.majorCategorySlug?.trim().toLowerCase();
      if (major) {
        parts.push(`majorSlug:=${major}`);
      }
      if (f.categorySlugs.length > 0) {
        const ors = f.categorySlugs.map((s) => `categorySlug:=${s.trim().toLowerCase()}`);
        parts.push(`(${ors.join(' || ')})`);
      }
      if (f.gender != null) {
        parts.push(`gender:=${f.gender}`);
      }
      if (f.priceMinVnd != null && f.priceMaxVnd != null) {
        parts.push(
          `minPriceVnd:<=${f.priceMaxVnd}&&maxPriceVnd:>=${f.priceMinVnd}`,
        );
      } else if (f.priceMinVnd != null) {
        parts.push(`maxPriceVnd:>=${f.priceMinVnd}`);
      } else if (f.priceMaxVnd != null) {
        parts.push(`minPriceVnd:<=${f.priceMaxVnd}`);
      }
    }
    if (args.radius != null) {
      const { centerLat, centerLng, radiusM } = args.radius;
      parts.push(
        `listingGeo:(${centerLat}, ${centerLng}, ${Math.max(1, Math.floor(radiusM))} m)`,
      );
    }
    return parts.join(' && ');
  }

  async searchSpecialistsGrouped(params: {
    sort: DirectoryListSort;
    page: number;
    perPageGroups: number;
    locale: ApiLocale;
    filters: SpecialistListApiFilters | null;
    radius: DirectoryListRadiusFilter | null;
  }): Promise<{ specialistIds: string[]; foundGroups: number }> {
    void params.locale;
    const filterBy = this.buildFilterBy({
      filters: params.filters,
      radius: params.radius,
    });
    const qRaw = params.filters?.q?.trim() ?? '';
    const q = qRaw.length > 0 ? qRaw : '*';
    const page = Math.max(1, Math.floor(params.page));
    const perPage = Math.max(1, Math.floor(params.perPageGroups));
    return this.search.searchListingEdgesGrouped({
      q,
      queryBy: 'offeringTitle,listingName,bio',
      filterBy,
      sortBy: this.sortByForGroupedSearch(params.sort),
      page,
      perPage,
      groupByField: 'specialistId',
      groupLimit: 1,
    });
  }

  async upsertListingEdge(edgeId: string): Promise<void> {
    const baseOk =
      await this.directoryRepository.specialistPassesDirectoryListingBaseEdge(
        edgeId,
      );
    if (!baseOk) {
      await this.search.deleteListingEdgeDocument(edgeId);
      return;
    }

    const row = await this.prisma.specialistOffering.findFirst({
      where: { id: edgeId, deletedAt: null },
      include: {
        priceOverrides: {
          select: { offeringPriceOptionId: true, customPrice: true },
        },
        specialist: {
          select: {
            id: true,
            gender: true,
            listedInDirectory: true,
            deletedAt: true,
            reviewsCount: true,
            ratingAverage: true,
            createdAt: true,
            bio: true,
            experienceYears: true,
            imageUrl: true,
            imageAlt: true,
            listingName: true,
            profilePublicationModerationStatus: true,
            activeOrganizationId: true,
            publishedProfileRevision: {
              select: {
                listingName: true,
                bio: true,
                imageUrl: true,
                imageAlt: true,
                status: true,
              },
            },
          },
        },
        organizationOffering: {
          include: {
            category: {
              select: {
                id: true,
                slug: true,
                majorServiceCategory: { select: { slug: true } },
              },
            },
            organization: {
              select: {
                id: true,
                deletedAt: true,
                publicationModerationStatus: true,
                address: {
                  select: { latitude: true, longitude: true },
                },
              },
            },
            priceOptions: {
              where: {
                deletedAt: null,
                status: OfferingPriceOptionStatus.active,
              },
              select: {
                id: true,
                priceAmount: true,
                currency: true,
                status: true,
                deletedAt: true,
              },
            },
          },
        },
      },
    });
    if (row == null) {
      await this.search.deleteListingEdgeDocument(edgeId);
      return;
    }

    const orgId = row.organizationOffering.organization.id;
    const pairs = await queryOrganizationStorefrontCategoryPairs(this.prisma, [
      orgId,
    ]);
    const vitrineCatIds = pairs.get(orgId) ?? new Set<string>();

    const doc = buildMarketplaceListingEdgeDocument({
      row: row as ListingEdgeSourceRow,
      vitrineCategoryIdsForOrg: vitrineCatIds,
    });
    if (doc == null) {
      await this.search.deleteListingEdgeDocument(edgeId);
      return;
    }
    await this.search.ensureListingEdgesCollection();
    await this.search.upsertListingEdgeDocument({
      edgeId: row.id,
      document: doc,
    });
  }

  async upsertAllEdgesForSpecialist(specialistId: string): Promise<void> {
    const ids = await this.prisma.specialistOffering.findMany({
      where: { specialistId, deletedAt: null },
      select: { id: true },
    });
    for (const { id } of ids) {
      await this.upsertListingEdge(id);
    }
  }

  /** Полная переиндексация всех активных рёбер (нет привязки к «личному показанному» профилю Service). */
  async reindexAllListingEdges(): Promise<{
    processed: number;
    errors: number;
  }> {
    await this.search.ensureListingEdgesCollection();
    const rows = await this.prisma.specialistOffering.findMany({
      where: { deletedAt: null },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    let errors = 0;
    let processed = 0;
    for (const chunk of chunked(rows.map((r) => r.id), 40)) {
      await Promise.all(
        chunk.map(async (id) => {
          try {
            await this.upsertListingEdge(id);
            processed += 1;
          } catch (e) {
            errors += 1;
            this.log.warn(`reindex edge ${id}: ${String(e)}`);
          }
        }),
      );
    }
    return { processed, errors };
  }
}

function chunked<T>(xs: readonly T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) {
    out.push([...xs.slice(i, i + n)]);
  }
  return out;
}
