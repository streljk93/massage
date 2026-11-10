import {
  OfferingPriceOptionStatus,
  OfferingPublicationStatus,
  Prisma,
} from '@prisma/client';
import type { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { getAllowedBodyZoneSlugsForCategory } from '../../specialists/domain/body-zone-compatibility';
import { DEFAULT_ORG_OFFERING_VND_PRICE_OPTIONS } from '../domain/default-offering-price-options';
import { buildOrgOfferingSlug } from '../domain/org-offering-slug';

async function syncAllowedBodyZonesForOffering(
  db: PrismaService | Prisma.TransactionClient,
  offeringId: string,
  category: {
    slug: string;
    majorServiceCategory: { id: string; slug: string };
  },
): Promise<void> {
  const allowedSlugs = getAllowedBodyZoneSlugsForCategory({
    majorSlug: category.majorServiceCategory.slug,
    categorySlug: category.slug,
  });
  if (allowedSlugs.length === 0) {
    return;
  }
  const zones = await db.bodyZone.findMany({
    where: {
      majorServiceCategoryId: category.majorServiceCategory.id,
      slug: { in: [...allowedSlugs] },
      deletedAt: null,
      isActive: true,
    },
    select: { id: true },
  });
  if (zones.length === 0) {
    return;
  }
  await db.organizationOfferingBodyZone.deleteMany({
    where: { organizationOfferingId: offeringId },
  });
  await db.organizationOfferingBodyZone.createMany({
    data: zones.map((z) => ({
      organizationOfferingId: offeringId,
      bodyZoneId: z.id,
    })),
  });
}

/**
 * Для каждой подкатегории — опубликованный оффер точки с активными VND-опциями (идемпотентно).
 * Нужен для онбординга: мастер выбирает навыки → в кабинете уже есть услуги с дефолтным прайсом.
 */
export async function ensurePublishedOrgOfferingsForCategories(
  db: PrismaService | Prisma.TransactionClient,
  params: {
    organizationId: string;
    orgSlug: string;
    categoryIds: readonly string[];
  },
): Promise<void> {
  const uniqCategoryIds = [...new Set(params.categoryIds)];
  if (uniqCategoryIds.length === 0) {
    return;
  }

  const categories = await db.serviceCategory.findMany({
    where: {
      id: { in: uniqCategoryIds },
      deletedAt: null,
      isActive: true,
    },
    select: {
      id: true,
      slug: true,
      name: true,
      majorServiceCategory: { select: { id: true, slug: true } },
    },
  });
  if (categories.length === 0) {
    return;
  }

  const now = new Date();

  for (const cat of categories) {
    const title =
      typeof cat.name === 'string' && cat.name.trim() !== ''
        ? cat.name.trim()
        : cat.slug;
    const slug = buildOrgOfferingSlug(params.orgSlug, cat.slug);

    let existing = await db.organizationOffering.findFirst({
      where: {
        organizationId: params.organizationId,
        categoryId: cat.id,
        deletedAt: null,
        publicationStatus: OfferingPublicationStatus.published,
      },
      select: {
        id: true,
        slug: true,
        publicationStatus: true,
        firstPublishedAt: true,
      },
    });
    if (existing == null) {
      existing = await db.organizationOffering.findFirst({
        where: {
          organizationId: params.organizationId,
          categoryId: cat.id,
          deletedAt: null,
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          slug: true,
          publicationStatus: true,
          firstPublishedAt: true,
        },
      });
    }

    if (existing == null) {
      const bySlug = await db.organizationOffering.findFirst({
        where: {
          organizationId: params.organizationId,
          slug,
          deletedAt: null,
        },
        select: {
          id: true,
          slug: true,
          publicationStatus: true,
          firstPublishedAt: true,
        },
      });
      existing = bySlug;
    }

    if (existing == null) {
      const created = await db.organizationOffering.create({
        data: {
          organizationId: params.organizationId,
          categoryId: cat.id,
          slug,
          publicationStatus: OfferingPublicationStatus.published,
          firstPublishedAt: now,
          lastPublishedAt: now,
          title,
          priceOptions: {
            create: [...DEFAULT_ORG_OFFERING_VND_PRICE_OPTIONS],
          },
        },
        select: { id: true },
      });
      await syncAllowedBodyZonesForOffering(db, created.id, cat);
      continue;
    }

    await db.organizationOffering.update({
      where: { id: existing.id },
      data: {
        publicationStatus: OfferingPublicationStatus.published,
        deletedAt: null,
        lastPublishedAt: now,
        firstPublishedAt: existing.firstPublishedAt ?? now,
      },
    });

    const activeVndCount = await db.offeringPriceOption.count({
      where: {
        organizationOfferingId: existing.id,
        deletedAt: null,
        status: OfferingPriceOptionStatus.active,
        currency: 'VND',
      },
    });
    if (activeVndCount === 0) {
      await db.offeringPriceOption.createMany({
        data: DEFAULT_ORG_OFFERING_VND_PRICE_OPTIONS.map((opt) => ({
          organizationOfferingId: existing!.id,
          ...opt,
        })),
      });
    }
    await syncAllowedBodyZonesForOffering(db, existing.id, cat);
  }
}
