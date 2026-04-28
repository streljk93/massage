/**
 * Каноничное хранимое представление адреса после разрешения у внешнего поставщика.
 * `source` — для аудита; в Prisma: `Address.sourceProvider` + `sourceReference`.
 */
import type { AddressProviderId } from './address-providers.const';

export type { AddressProviderId } from './address-providers.const';

export type CanonicalAddress = {
  addressLine: string;
  city: string | null;
  latitude: number;
  longitude: number;
  sourceProvider: AddressProviderId;
  sourceReference: string;
};
