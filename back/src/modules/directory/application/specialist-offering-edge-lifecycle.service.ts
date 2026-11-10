import { Injectable } from '@nestjs/common';
import {
  OfferingPriceOptionStatus,
  OfferingPublicationStatus,
  Prisma,
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

  /** При добавлении в команду салона — все опубликованные услуги организации, без фильтра по навыкам. */
  async assignSpecialistToAllPublishedOrgOfferingsAtOrganization(
    specialistId: string,
    organizationId: string,
  ): Promise<void> {
    const rows = await this.prisma.organizationOffering.findMany({
      where: this.publishedOrgOfferingWhere(organizationId, undefined),
      select: { id: true },
    });
    await this.prisma.$transaction(async (tx) => {
      await this.upsertActiveEdgesForOfferings(
        tx,
        specialistId,
        rows.map((r) => r.id),
      );
    });
    await this.listingEdges.upsertAllEdgesForSpecialist(specialistId);
  }

  async reconcileAssignmentsForSpecialist(specialistId: string): Promise<void> {
    const specialist = await this.prisma.specialist.findFirst({
      where: { id: specialistId, deletedAt: null },
      select: {
        id: true,
        workplaces: {
          where: { isActive: true, deletedAt: null },
          select: { organizationId: true },
          take: 1,
        },
      },
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

    const orgId = specialist.workplaces[0]?.organizationId ?? null;

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

    let desiredOfferingIds: Set<string>;

    if (orgId == null) {
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

    if (categoryIds.length === 0) {
      const employed =
        await this.prisma.specialistOrganizationEmployment.findFirst({
          where: { specialistId, organizationId: orgId, isActive: true },
          select: { id: true },
        });
      if (employed == null) {
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
      const allAtOrg = await this.prisma.organizationOffering.findMany({
        where: this.publishedOrgOfferingWhere(orgId, undefined),
        select: { id: true },
      });
      desiredOfferingIds = new Set(allAtOrg.map((r) => r.id));
    } else {
      const desiredRows = await this.prisma.organizationOffering.findMany({
        where: this.publishedOrgOfferingWhere(orgId, { in: categoryIds }),
        select: { id: true },
      });
      desiredOfferingIds = new Set(desiredRows.map((r) => r.id));
    }

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

      await this.upsertActiveEdgesForOfferings(
        tx,
        specialistId,
        desiredOfferingIds,
      );
    });

    await this.flushIndexRemovalsThenRefresh(removedEdgeIds, specialistId);
  }

  private publishedOrgOfferingWhere(
    organizationId: string,
    categoryFilter: { in: string[] } | undefined,
  ) {
    return {
      organizationId,
      deletedAt: null,
      publicationStatus: OfferingPublicationStatus.published,
      ...(categoryFilter != null ? { categoryId: categoryFilter } : {}),
      priceOptions: {
        some: {
          deletedAt: null,
          status: OfferingPriceOptionStatus.active,
          currency: 'VND',
        },
      },
    };
  }

  private async upsertActiveEdgesForOfferings(
    tx: Prisma.TransactionClient,
    specialistId: string,
    organizationOfferingIds: Iterable<string>,
  ): Promise<void> {
    for (const organizationOfferingId of organizationOfferingIds) {
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
