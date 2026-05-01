import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AddressSearchProviderPort } from '../domain/address-search-provider.port';
import { DEFAULT_ADDRESS_PROVIDER_ORDER } from '../domain/address-providers.const';
import { GeoapifyAddressHttpService } from './geoapify-address.http.service';
import { LocationIqAddressHttpService } from './locationiq-address.http.service';
import { NominatimAddressHttpService } from './nominatim-address.http.service';
import { OpenCageAddressHttpService } from './opencage-address.http.service';

/**
 * Реестр адаптеров: порядок из конфига (`ADDRESS_PROVIDER_ORDER` или дефолт из `DEFAULT_ADDRESS_PROVIDER_ORDER`).
 * Неизвестные id — warning и пропуск.
 */
@Injectable()
export class AddressProviderRegistry {
  private readonly log = new Logger(AddressProviderRegistry.name);
  private readonly byId: Map<string, AddressSearchProviderPort>;

  constructor(
    private readonly config: ConfigService,
    private readonly locationiq: LocationIqAddressHttpService,
    private readonly opencage: OpenCageAddressHttpService,
    private readonly geoapify: GeoapifyAddressHttpService,
    private readonly nominatim: NominatimAddressHttpService,
  ) {
    this.byId = new Map<string, AddressSearchProviderPort>([
      ['locationiq', this.locationiq],
      ['opencage', this.opencage],
      ['geoapify', this.geoapify],
      ['nominatim', this.nominatim],
    ]);
  }

  getProviderById(id: string): AddressSearchProviderPort | undefined {
    return this.byId.get(id);
  }

  private effectiveOrder(): string[] {
    const fromEnv = this.config.get<string[]>('address.providerOrder', []);
    if (fromEnv.length > 0) {
      return [...fromEnv];
    }
    return [...DEFAULT_ADDRESS_PROVIDER_ORDER];
  }

  /**
   * Порядок и только «сконфигурированные» (есть ключ / user-agent для Nominatim).
   */
  getOrderedActiveProviders(): AddressSearchProviderPort[] {
    const order = this.effectiveOrder();
    const out: AddressSearchProviderPort[] = [];
    for (const id of order) {
      const p = this.byId.get(id);
      if (p == null) {
        this.log.warn(
          `unknown address provider in ADDRESS_PROVIDER_ORDER: ${id}`,
        );
        continue;
      }
      if (p.isConfigured()) {
        out.push(p);
      }
    }
    return out;
  }

  requestTimeoutMs(): number {
    return this.config.get<number>('address.requestTimeoutMs', 3500);
  }
}
