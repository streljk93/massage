import { createHash } from 'node:crypto';

import type { Prisma } from '@prisma/client';

/** Текущая версия контракта полей `BookingSnapshot` (см. ADR marketplace / план домена). */
export const BOOKING_SNAPSHOT_SCHEMA_VERSION = 1;

const SNAPSHOT_HASH_PREFIX = 'sha256|booking_snapshot';

/**
 * Строки `BookingSnapshot`, созданные до появления поля `hashAlgo` в каноническом JSON,
 * несовместимы по сырому hex с новыми — это ожидаемо; сравнение старых и новых `snapshotHash` не выполнять.
 */
function canonicalSnapshotPayloadShape(input: {
  bookingId: string;
  organizationOfferingId: string;
  offeringPriceOptionId: string;
  organizationOfferingTitleSnapshot: string | null;
  organizationNameSnapshot: string | null;
  specialistDisplayNameSnapshot: string | null;
  durationMinutesSnapshot: number;
  priceAmountSnapshot: number | null;
  currencySnapshot: string | null;
  addressLineSnapshot: string | null;
  citySnapshot: string | null;
}): string {
  const canonical = {
    hashAlgo: 'sha256' as const,
    entity: 'BookingSnapshot' as const,
    schemaVersion: BOOKING_SNAPSHOT_SCHEMA_VERSION,
    ...input,
  };
  return JSON.stringify(canonical);
}

export function computeBookingSnapshotHash(input: {
  bookingId: string;
  organizationOfferingId: string;
  offeringPriceOptionId: string;
  organizationOfferingTitleSnapshot: string | null;
  organizationNameSnapshot: string | null;
  specialistDisplayNameSnapshot: string | null;
  durationMinutesSnapshot: number;
  priceAmountSnapshot: number | null;
  currencySnapshot: string | null;
  addressLineSnapshot: string | null;
  citySnapshot: string | null;
}): string {
  const hex = createHash('sha256')
    .update(canonicalSnapshotPayloadShape(input), 'utf8')
    .digest('hex');
  return `${SNAPSHOT_HASH_PREFIX}|v${BOOKING_SNAPSHOT_SCHEMA_VERSION}|${hex}`;
}

export type BuildBookingSnapshotInput = {
  bookingId: string;
  organizationOfferingId: string;
  offeringPriceOptionId: string;
  organizationOfferingTitleSnapshot: string | null;
  organizationNameSnapshot: string | null;
  specialistDisplayNameSnapshot: string | null;
  durationMinutesSnapshot: number;
  priceAmountSnapshot: number | null;
  currencySnapshot: string | null;
  addressLineSnapshot: string | null;
  citySnapshot: string | null;
  payload?: Prisma.InputJsonValue | null;
};

/** Единая точка сборки снимка брони при создании (не размазывать по сервисам). */
export function buildBookingSnapshotCreateData(
  input: BuildBookingSnapshotInput,
): Prisma.BookingSnapshotUncheckedCreateInput {
  const snapshotHash = computeBookingSnapshotHash({
    bookingId: input.bookingId,
    organizationOfferingId: input.organizationOfferingId,
    offeringPriceOptionId: input.offeringPriceOptionId,
    organizationOfferingTitleSnapshot: input.organizationOfferingTitleSnapshot,
    organizationNameSnapshot: input.organizationNameSnapshot,
    specialistDisplayNameSnapshot: input.specialistDisplayNameSnapshot,
    durationMinutesSnapshot: input.durationMinutesSnapshot,
    priceAmountSnapshot: input.priceAmountSnapshot,
    currencySnapshot: input.currencySnapshot,
    addressLineSnapshot: input.addressLineSnapshot,
    citySnapshot: input.citySnapshot,
  });
  return {
    bookingId: input.bookingId,
    organizationOfferingId: input.organizationOfferingId,
    offeringPriceOptionId: input.offeringPriceOptionId,
    organizationOfferingTitleSnapshot: input.organizationOfferingTitleSnapshot,
    organizationNameSnapshot: input.organizationNameSnapshot,
    specialistDisplayNameSnapshot: input.specialistDisplayNameSnapshot,
    durationMinutesSnapshot: input.durationMinutesSnapshot,
    priceAmountSnapshot: input.priceAmountSnapshot,
    currencySnapshot: input.currencySnapshot ?? 'VND',
    addressLineSnapshot: input.addressLineSnapshot,
    citySnapshot: input.citySnapshot,
    snapshotSchemaVersion: BOOKING_SNAPSHOT_SCHEMA_VERSION,
    snapshotHash,
    payload: input.payload ?? undefined,
  };
}
