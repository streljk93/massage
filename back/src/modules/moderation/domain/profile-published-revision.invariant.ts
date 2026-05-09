import type { Prisma } from '@prisma/client';
import {
  OrganizationProfileRevisionStatus,
  SpecialistProfileRevisionStatus,
} from '@prisma/client';

/**
 * Инвариант: `publishedProfileRevisionId` — указатель на ревизию со статусом `published` и тем же мастером.
 * Вызывать после операций промоута (и при необходимости в reconcile/cron).
 */
export async function assertSpecialistPublishedPointerCoherent(
  tx: Prisma.TransactionClient,
  specialistId: string,
): Promise<void> {
  const s = await tx.specialist.findFirst({
    where: { id: specialistId, deletedAt: null },
    select: { publishedProfileRevisionId: true },
  });
  const pid = s?.publishedProfileRevisionId ?? null;
  if (pid == null) {
    return;
  }
  const rev = await tx.specialistProfileRevision.findFirst({
    where: { id: pid },
    select: { specialistId: true, status: true },
  });
  if (
    rev == null ||
    rev.specialistId !== specialistId ||
    rev.status !== SpecialistProfileRevisionStatus.published
  ) {
    throw new Error(
      `Нарушен инвариант Specialist.publishedProfileRevisionId: specialist=${specialistId}, revision=${pid}, rev=${rev ? `${rev.specialistId}/${rev.status}` : 'null'}`,
    );
  }
}

/**
 * Инвариант: опубликованный профиль организации указывает только на `published` ревизию этой организации.
 */
export async function assertOrganizationPublishedPointerCoherent(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<void> {
  const o = await tx.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    select: { publishedProfileRevisionId: true },
  });
  const pid = o?.publishedProfileRevisionId ?? null;
  if (pid == null) {
    return;
  }
  const rev = await tx.organizationProfileRevision.findFirst({
    where: { id: pid },
    select: { organizationId: true, status: true },
  });
  if (
    rev == null ||
    rev.organizationId !== organizationId ||
    rev.status !== OrganizationProfileRevisionStatus.published
  ) {
    throw new Error(
      `Нарушен инвариант Organization.publishedProfileRevisionId: organization=${organizationId}, revision=${pid}, rev=${rev ? `${rev.organizationId}/${rev.status}` : 'null'}`,
    );
  }
}
