import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GalleryMediaKind,
  GalleryOwnerKind,
  OrganizationMembershipRole,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

export type GallerySeedItem = {
  url: string;
  alt: string | null;
  kind: GalleryMediaKind;
};

@Injectable()
export class GalleryService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertUserCanManageOrganizationVitrineGallery(
    userId: string,
    organizationId: string,
  ): Promise<void> {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { id: true, ownerUserId: true },
    });
    if (!org) {
      throw new NotFoundException({
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Organization not found',
      });
    }
    if (org.ownerUserId === userId) {
      return;
    }
    const specialist = await this.prisma.specialist.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    if (!specialist) {
      throw new ForbiddenException({
        code: 'NOT_ORGANIZATION_MANAGER',
        message:
          'Only the organization owner or an active admin can manage galleries for this organization',
      });
    }
    const emp = await this.prisma.specialistOrganizationEmployment.findFirst({
      where: {
        specialistId: specialist.id,
        organizationId,
        isActive: true,
        role: {
          in: [
            OrganizationMembershipRole.owner,
            OrganizationMembershipRole.admin,
          ],
        },
      },
      select: { id: true },
    });
    if (!emp) {
      throw new ForbiddenException({
        code: 'NOT_ORGANIZATION_MANAGER',
        message:
          'Only the organization owner or an active admin can manage galleries for this organization',
      });
    }
  }

  private async assertUserCanManageGallery(
    userId: string,
    gallery: { ownerKind: GalleryOwnerKind; ownerId: string },
  ): Promise<void> {
    if (gallery.ownerKind === GalleryOwnerKind.organization) {
      await this.assertUserCanManageOrganizationVitrineGallery(
        userId,
        gallery.ownerId,
      );
      return;
    }
    throw new BadRequestException({
      code: 'GALLERY_OWNER_KIND_UNSUPPORTED',
      message: 'Managing this gallery owner kind is not supported yet',
    });
  }

  async seedItemsInTransaction(
    tx: Prisma.TransactionClient,
    galleryId: string,
    items: GallerySeedItem[],
  ): Promise<void> {
    if (items.length === 0) {
      return;
    }
    await tx.galleryItem.createMany({
      data: items.map((item, idx) => ({
        galleryId,
        url: item.url,
        alt: item.alt,
        kind: item.kind,
        sortOrder: idx,
      })),
    });
  }

  /**
   * Галерея витрины организации (для кабинета: получить `galleryId` и порядок перед PATCH …/items/order).
   */
  async getOrganizationVitrineGalleryForManagers(
    userId: string,
    organizationId: string,
  ): Promise<{
    galleryId: string | null;
    items: Array<{
      id: string;
      url: string;
      alt: string | null;
      kind: GalleryMediaKind;
      sortOrder: number;
    }>;
  }> {
    await this.assertUserCanManageOrganizationVitrineGallery(
      userId,
      organizationId,
    );
    const gallery = await this.prisma.gallery.findUnique({
      where: {
        ownerKind_ownerId: {
          ownerKind: GalleryOwnerKind.organization,
          ownerId: organizationId,
        },
      },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!gallery) {
      return { galleryId: null, items: [] };
    }
    return {
      galleryId: gallery.id,
      items: gallery.items.map((it) => ({
        id: it.id,
        url: it.url,
        alt: it.alt,
        kind: it.kind,
        sortOrder: it.sortOrder,
      })),
    };
  }

  async reorderItems(
    userId: string,
    galleryId: string,
    orderedItemIds: string[],
  ): Promise<void> {
    const gallery = await this.prisma.gallery.findFirst({
      where: { id: galleryId },
    });
    if (!gallery) {
      throw new NotFoundException({
        code: 'GALLERY_NOT_FOUND',
        message: 'Gallery not found',
      });
    }
    await this.assertUserCanManageGallery(userId, gallery);

    const rows = await this.prisma.galleryItem.findMany({
      where: { galleryId },
      select: { id: true },
    });
    const idSet = new Set(rows.map((r) => r.id));

    if (new Set(orderedItemIds).size !== orderedItemIds.length) {
      throw new BadRequestException({
        code: 'GALLERY_ORDER_DUPLICATE_IDS',
        message: 'Duplicate gallery item ids',
      });
    }
    if (
      orderedItemIds.length !== idSet.size ||
      !orderedItemIds.every((id) => idSet.has(id))
    ) {
      throw new BadRequestException({
        code: 'GALLERY_ORDER_MISMATCH',
        message:
          'orderedItemIds must list every item in this gallery exactly once',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < orderedItemIds.length; i++) {
        const id = orderedItemIds[i]!;
        await tx.galleryItem.update({
          where: { id },
          data: { sortOrder: i },
        });
      }
    });
  }
}
