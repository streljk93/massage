import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

export type PersistedAddressInput = {
  addressLine: string;
  city: string | null;
  latitude: number;
  longitude: number;
  sourceProvider: string;
  sourceReference: string | null;
};

@Injectable()
export class AddressPersistenceService {
  createInTransaction(
    tx: Prisma.TransactionClient,
    input: PersistedAddressInput,
  ) {
    return tx.address.create({
      data: {
        addressLine: input.addressLine,
        city: input.city,
        latitude: input.latitude,
        longitude: input.longitude,
        sourceProvider: input.sourceProvider,
        sourceReference: input.sourceReference,
      },
    });
  }
}
