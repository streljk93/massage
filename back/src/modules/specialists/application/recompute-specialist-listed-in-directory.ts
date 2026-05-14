import type { Prisma } from '@prisma/client';
import { computeListedInDirectory } from '../domain/specialist-directory-flags';

/**
 * Единственная write-side точка обновления persisted projection видимости мастера.
 * Read-side код должен читать `Specialist.listedInDirectory`.
 */
export async function recomputeListedInDirectoryTx(
  tx: Prisma.TransactionClient,
  specialistId: string,
): Promise<boolean> {
  const [specialist, activeWorkplacesCount] = await Promise.all([
    tx.specialist.findUnique({
      where: { id: specialistId },
      select: { onboardingCompletedAt: true },
    }),
    tx.specialistWorkplace.count({
      where: {
        specialistId,
        isActive: true,
        deletedAt: null,
      },
    }),
  ]);
  const hasActiveWorkplace = activeWorkplacesCount > 0;
  const visible = computeListedInDirectory({
    onboardingCompletedAt: specialist?.onboardingCompletedAt ?? null,
    hasActiveWorkplace,
  });
  await tx.specialist.update({
    where: { id: specialistId },
    data: { listedInDirectory: visible },
  });
  await tx.specialistSearchProjection.updateMany({
    where: { specialistId },
    data: { isActive: hasActiveWorkplace, hasActiveWorkplace },
  });
  return visible;
}
