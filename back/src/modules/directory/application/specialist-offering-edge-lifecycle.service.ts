import { Injectable } from '@nestjs/common';
import {
  OfferingPriceOptionStatus,
  OfferingPublicationStatus,
  SpecialistOfferingStatus,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { MarketplaceListingEdgesIndexService } from './marketplace-listing-edges-index.service';

/**
 * Инвариант marketplace-листинга (indexed path): строка без рёбер `SpecialistOffering` не имеет документов в Typesense.
 * Согласование пересечения подкатегорий мастера с опубликованными офферами активного места приёма после смены workplace / навыков.
 */
@Injectable()
export class SpecialistOfferingEdgeLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listingEdges: MarketplaceListingEdgesIndexService,
  ) {}

  async reconcileAssignmentsForSpecialist(specialistId: string): Promise<void> {
    const specialist = await this.prisma.specialist.findFirst({
      where: { id: specialistId, deletedAt: null },
      select: { id: true, activeOrganizationId: true },
    });
    if (specialist == null) {
      return;
    }

    const categoryRows = await this.prisma.specialistSkill.findMany({
      where: { specialistId },
      select: { serviceCategoryId: true },
    });
    const categoryIds = [
      ...new Set(categoryRows.map((r) => r.serviceCategoryId)),
    ];

    const activeEdges = await this.prisma.specialistOffering.findMany({
      where: { specialistId, deletedAt: null },
      select: {
        id: true,
        organizationOfferingId: true,
        organizationOffering: {
          select: { organizationId: true, deletedAt: true },
        },
      },
    });

    const removedEdgeIds: string[] = [];
    const now = new Date();

    if (
      specialist.activeOrganizationId == null ||
      specialist.activeOrganizationId.trim() === '' ||
      categoryIds.length === 0
    ) {
      for (const e of activeEdges) {
        removedEdgeIds.push(e.id);
      }
      if (removedEdgeIds.length > 0) {
        await this.prisma.specialistOffering.updateMany({
          where: { id: { in: removedEdgeIds } },
          data: {
            deletedAt: now,
            status: SpecialistOfferingStatus.removed,
          },
        });
      }
      await this.flushIndexRemovalsThenRefresh(removedEdgeIds, specialistId);
      return;
    }

    const orgId = specialist.activeOrganizationId;

    const desiredRows = await this.prisma.organizationOffering.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        publicationStatus: OfferingPublicationStatus.published,
        categoryId: { in: categoryIds },
        priceOptions: {
          some: {
            deletedAt: null,
            status: OfferingPriceOptionStatus.active,
            currency: 'VND',
          },
        },
      },
      select: { id: true },
    });
    const desiredOfferingIds = new Set(desiredRows.map((r) => r.id));

    for (const e of activeEdges) {
      const off = e.organizationOffering;
      const stale =
        off.deletedAt != null ||
        off.organizationId !== orgId ||
        !desiredOfferingIds.has(e.organizationOfferingId);
      if (stale) {
        removedEdgeIds.push(e.id);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (removedEdgeIds.length > 0) {
        await tx.specialistOffering.updateMany({
          where: { id: { in: removedEdgeIds } },
          data: {
            deletedAt: now,
            status: SpecialistOfferingStatus.removed,
          },
        });
      }

      for (const organizationOfferingId of desiredOfferingIds) {
        const row = await tx.specialistOffering.findUnique({
          where: {
            specialistId_organizationOfferingId: {
              specialistId,
              organizationOfferingId,
            },
          },
          select: { id: true, deletedAt: true, status: true },
        });
        if (row == null) {
          await tx.specialistOffering.create({
            data: {
              specialistId,
              organizationOfferingId,
              status: SpecialistOfferingStatus.active,
            },
          });
          continue;
        }
        const patch: { deletedAt: null; status: SpecialistOfferingStatus } = {
          deletedAt: null,
          status: SpecialistOfferingStatus.active,
        };
        if (
          row.deletedAt != null ||
          row.status !== SpecialistOfferingStatus.active
        ) {
          await tx.specialistOffering.update({
            where: { id: row.id },
            data: patch,
          });
        }
      }
    });

    await this.flushIndexRemovalsThenRefresh(removedEdgeIds, specialistId);
  }

  private async flushIndexRemovalsThenRefresh(
    removedEdgeIds: readonly string[],
    specialistId: string,
  ): Promise<void> {
    for (const id of removedEdgeIds) {
      await this.listingEdges.upsertListingEdge(id);
    }
    await this.listingEdges.upsertAllEdgesForSpecialist(specialistId);
  }
}
