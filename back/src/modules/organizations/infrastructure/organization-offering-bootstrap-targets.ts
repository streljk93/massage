import { OrganizationMembershipRole, Prisma } from '@prisma/client';
import type { PrismaService } from '../../../infrastructure/prisma/prisma.service';

export type OrganizationOfferingBootstrapTarget = {
  organizationId: string;
  orgSlug: string;
};

/** Организации, для которых при онбординге создаём офферы по навыкам мастера. */
export async function resolveOrganizationOfferingBootstrapTargets(
  db: PrismaService | Prisma.TransactionClient,
  specialistId: string,
): Promise<OrganizationOfferingBootstrapTarget[]> {
  const byId = new Map<string, string>();

  const specialist = await db.specialist.findFirst({
    where: { id: specialistId, deletedAt: null },
    select: {
      activeOrganizationId: true,
      activeOrganization: {
        select: { id: true, slug: true, deletedAt: true },
      },
    },
  });
  if (specialist?.activeOrganizationId != null && specialist.activeOrganization) {
    const org = specialist.activeOrganization;
    if (org.deletedAt == null) {
      byId.set(org.id, org.slug);
    }
  }

  const activeWorkplace = await db.specialistWorkplace.findFirst({
    where: { specialistId, isActive: true, deletedAt: null },
    select: {
      organization: { select: { id: true, slug: true, deletedAt: true } },
    },
  });
  const wpOrg = activeWorkplace?.organization;
  if (wpOrg != null && wpOrg.deletedAt == null) {
    byId.set(wpOrg.id, wpOrg.slug);
  }

  const employments = await db.specialistOrganizationEmployment.findMany({
    where: {
      specialistId,
      isActive: true,
      role: {
        in: [
          OrganizationMembershipRole.owner,
          OrganizationMembershipRole.admin,
        ],
      },
      organization: { deletedAt: null },
    },
    select: {
      organization: { select: { id: true, slug: true } },
    },
  });
  for (const row of employments) {
    byId.set(row.organization.id, row.organization.slug);
  }

  return [...byId.entries()].map(([organizationId, orgSlug]) => ({
    organizationId,
    orgSlug,
  }));
}

export async function filterServiceCategoryIdsForOrganizationMajors(
  db: PrismaService | Prisma.TransactionClient,
  organizationId: string,
  serviceCategoryIds: readonly string[],
): Promise<string[]> {
  const uniq = [...new Set(serviceCategoryIds)];
  if (uniq.length === 0) {
    return [];
  }
  const majorRows = await db.organizationMajorServiceCategory.findMany({
    where: { organizationId },
    select: { majorServiceCategoryId: true },
  });
  const allowedMajors = new Set(
    majorRows.map((r) => r.majorServiceCategoryId),
  );
  if (allowedMajors.size === 0) {
    return [];
  }
  const categories = await db.serviceCategory.findMany({
    where: {
      id: { in: uniq },
      deletedAt: null,
      isActive: true,
    },
    select: { id: true, majorServiceCategoryId: true },
  });
  return categories
    .filter((c) => allowedMajors.has(c.majorServiceCategoryId))
    .map((c) => c.id);
}
