import type { ApiLocale } from '../../../common/i18n/api-locale';
import type { CanonicalAddress } from './canonical-address.model';
import type { AddressProviderId } from './address-providers.const';
import type { AddressSuggestionItem } from './address-suggestion.model';

/**
 * Адаптер внешнего сервиса поиска/разрешения адресов.
 * Реализации: `*AddressHttpService` в `infrastructure/`, реестр — {@link AddressProviderRegistry}.
 */
export type AddressProviderResolveOptions = {
  /** Локаль подписей/формата у поставщика (если поддерживает). */
  locale?: ApiLocale;
};

export interface AddressSearchProviderPort {
  /** Совпадает с `ADDRESS_PROVIDER_ORDER` / `placeReference.provider` / `suggestion.provider`. */
  readonly providerId: AddressProviderId;
  isConfigured(): boolean;
  getSuggestions(
    query: string,
    options: AddressProviderResolveOptions,
    requestTimeoutMs: number,
  ): Promise<readonly AddressSuggestionItem[]>;
  resolveByPlaceId(
    placeId: string,
    options: AddressProviderResolveOptions,
    requestTimeoutMs: number,
  ): Promise<CanonicalAddress>;
  /** Обратное геокодирование (точка → канонический адрес + стабильный `sourceReference`). */
  reverseFromCoordinates(
    latitude: number,
    longitude: number,
    options: AddressProviderResolveOptions,
    requestTimeoutMs: number,
  ): Promise<CanonicalAddress>;
}
