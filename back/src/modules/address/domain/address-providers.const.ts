/**
 * Идентификаторы внешних поставщиков адреса.
 * `placeId` / `sourceReference` привязаны к конкретному провайдеру (см. реализацию `resolveByPlaceId`).
 */
export const ADDRESS_PROVIDERS = [
  'locationiq',
  'geoapify',
  'opencage',
  'nominatim',
] as const;

export type AddressProviderId =
  | (typeof ADDRESS_PROVIDERS)[number]
  | (string & {});

/**
 * Единственный дефолтный порядок провайдеров в репозитории (если не задан `ADDRESS_PROVIDER_ORDER` в env).
 * Менять приоритеты — здесь или через env; не дублировать список в `configuration.ts`.
 */
export const DEFAULT_ADDRESS_PROVIDER_ORDER: readonly AddressProviderId[] = [
  'nominatim',
  'locationiq',
  'geoapify',
  'opencage',
];

export const isKnownAddressProvider = (
  id: string,
): id is (typeof ADDRESS_PROVIDERS)[number] =>
  (ADDRESS_PROVIDERS as readonly string[]).includes(id);
