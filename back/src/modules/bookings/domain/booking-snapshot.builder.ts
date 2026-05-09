import type { Prisma } from '@prisma/client';

/** Текущая версия контракта полей `BookingSnapshot` (см. ADR marketplace / план домена). */
export const BOOKING_SNAPSHOT_SCHEMA_VERSION = 1;

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
    payload: input.payload ?? undefined,
  };
}
