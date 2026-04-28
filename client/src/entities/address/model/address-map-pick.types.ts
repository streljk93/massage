/**
 * Данные для сохранения адреса (совместимы с `placeReference` / ответом resolve на бэкенде).
 */
export const ADDRESS_PROVIDER_IDS = [
  "locationiq",
  "geoapify",
  "opencage",
  "nominatim",
] as const;

export type AddressProviderId = (typeof ADDRESS_PROVIDER_IDS)[number];

export function isAddressProviderId(v: string): v is AddressProviderId {
  return (ADDRESS_PROVIDER_IDS as readonly string[]).includes(v);
}

export type AddressPlaceReference = {
  provider: AddressProviderId;
  placeId: string;
};

/** Результат выбора в виджете карты — уходит в `placeReference` или в формы с полным адресом. */
export type AddressMapPickResult = {
  addressLine: string;
  city: string | null;
  latitude: number;
  longitude: number;
  sourceProvider: AddressProviderId;
  sourceReference: string;
};

export function addressMapPickFromResolved(r: {
  addressLine: string;
  city: string | null;
  latitude: number;
  longitude: number;
  sourceProvider: string;
  sourceReference: string;
}): AddressMapPickResult | null {
  if (!isAddressProviderId(r.sourceProvider)) {
    return null;
  }
  return {
    addressLine: r.addressLine,
    city: r.city,
    latitude: r.latitude,
    longitude: r.longitude,
    sourceProvider: r.sourceProvider,
    sourceReference: r.sourceReference,
  };
}
