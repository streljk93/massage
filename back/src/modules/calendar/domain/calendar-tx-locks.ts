import type { Prisma } from '@prisma/client';

function twoPartFnv1a32(input: string): [number, number] {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return [h & 0xffff, (h >>> 16) & 0xffff];
}

async function pgAdvisoryXactLockPair(
  tx: Prisma.TransactionClient,
  keys: [number, number],
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${keys[0]}::int4, ${keys[1]}::int4)`;
}

export const CalendarTxLocks = {
  async acquireResourceSlotExclusion(
    tx: Prisma.TransactionClient,
    resourceId: string,
  ): Promise<void> {
    await pgAdvisoryXactLockPair(
      tx,
      twoPartFnv1a32(`calendar_resource_slot:${resourceId}`),
    );
  },

  async acquireResourceIdentity(
    tx: Prisma.TransactionClient,
    args: { organizationId: string; specialistId: string },
  ): Promise<void> {
    await pgAdvisoryXactLockPair(
      tx,
      twoPartFnv1a32(
        `calendar_specialist_resource:${args.organizationId}:${args.specialistId}`,
      ),
    );
  },
} as const;

export function normalizeCalendarResourceIdsForLock(
  resourceIds: readonly string[],
): string[] {
  return [...new Set(resourceIds)].sort();
}
