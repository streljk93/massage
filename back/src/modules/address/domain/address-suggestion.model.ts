import type { AddressProviderId } from './address-providers.const';
import type { CanonicalAddress } from './canonical-address.model';

/** Одна подсказка в списке автодополнения (независимо от внешнего API). */
export type AddressSuggestionItem = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  provider: AddressProviderId;
  /**
   * Когда геокодер уже отдал координаты и ту же опорную строку, что дал бы `/resolve`,
   * клиент может не вызывать `POST /address/resolve` (достаточно для карты / онбординга).
   */
  resolved?: CanonicalAddress;
};
