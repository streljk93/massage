import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AddressProviderId } from '../domain/address-providers.const';
import type { CanonicalAddress } from '../domain/canonical-address.model';
import type {
  AddressProviderResolveOptions,
  AddressSearchProviderPort,
} from '../domain/address-search-provider.port';
import type { AddressSuggestionItem } from '../domain/address-suggestion.model';
import { pickCityFromOsmStyleAddress } from './address-osm-locality.util';
import { fetchWithTimeout, isFallbackHttpStatus } from './address-http.util';

const NOM_PLACE = /^nom\|([NWR])\|(\d+)$/;

/**
 * OpenStreetMap Nominatim (use policy: user-agent, не злоупотреблять).
 * @see https://nominatim.org/release-docs/develop/api/Search/
 */
@Injectable()
export class NominatimAddressHttpService implements AddressSearchProviderPort {
  private readonly log = new Logger(NominatimAddressHttpService.name);
  readonly providerId: AddressProviderId = 'nominatim';
  private readonly defaultBase = 'https://nominatim.openstreetmap.org';

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return this.getUserAgent().length > 0;
  }

  private getUserAgent(): string {
    return (
      this.config.get<string>('address.nominatim.userAgent', '')?.trim() ?? ''
    );
  }

  private getBaseUrl(): string {
    return (
      this.config
        .get<string>('address.nominatim.baseUrl', this.defaultBase)
        ?.trim()
        .replace(/\/$/, '') ?? this.defaultBase
    );
  }

  private headersJson(): { 'User-Agent': string; Accept: 'application/json' } {
    return {
      'User-Agent': this.getUserAgent(),
      Accept: 'application/json',
    };
  }

  private encodeOsmId(type: 'node' | 'way' | 'relation', id: number): string {
    const p = type === 'node' ? 'N' : type === 'way' ? 'W' : 'R';
    return `nom|${p}|${id}`;
  }

  private parseOsmId(raw: string): { osmIds: string } {
    const m = raw.trim().match(NOM_PLACE);
    if (!m) {
      throw new BadRequestException({
        code: 'ADDRESS_NOM_BAD_PLACE',
        message: 'Invalid Nominatim place id',
      });
    }
    const letter = m[1];
    const id = m[2];
    return {
      osmIds: `${letter}${id}`,
    };
  }

  async getSuggestions(
    query: string,
    _options: AddressProviderResolveOptions,
    requestTimeoutMs: number,
  ): Promise<readonly AddressSuggestionItem[]> {
    if (!this.isConfigured()) {
      return [];
    }
    const q = query.trim();
    if (q.length < 2) {
      return [];
    }
    const u = new URL(`${this.getBaseUrl()}/search`);
    u.searchParams.set('format', 'json');
    u.searchParams.set('addressdetails', '1');
    u.searchParams.set('q', q);
    u.searchParams.set('limit', '5');
    let res: Response;
    try {
      res = await fetchWithTimeout(
        u.toString(),
        { method: 'GET', headers: this.headersJson() },
        requestTimeoutMs,
      );
    } catch {
      return [];
    }
    if (!res.ok) {
      if (isFallbackHttpStatus(res.status)) {
        this.log.debug(`search http ${res.status}`);
      } else {
        this.log.warn(`search http ${res.status}`);
      }
      return [];
    }
    const list = (await res.json()) as {
      place_id: number;
      osm_id: number;
      osm_type: string;
      display_name: string;
      class?: string;
      importance?: number;
      addresstype?: string;
      lat?: string;
      lon?: string;
      address?: Record<string, string>;
    }[];
    if (!Array.isArray(list)) {
      return [];
    }
    /** Без порога `importance`: у домов/дорог часто низкий importance — иначе массив пустеет и срабатывает fallback на следующий провайдер в цепочке. */
    const out: AddressSuggestionItem[] = [];
    for (const r of list) {
      const t = (r.osm_type ?? 'way') as 'node' | 'relation' | 'way';
      if (r.osm_id == null) {
        continue;
      }
      const d = (r.display_name ?? '').trim();
      if (d.length < 2) {
        continue;
      }
      const placeId = this.encodeOsmId(t, r.osm_id);
      const lat = Number(r.lat);
      const lon = Number(r.lon);
      const item: AddressSuggestionItem = {
        placeId,
        mainText: d.split(',')[0]?.trim() ?? d.slice(0, 100),
        secondaryText: d.slice(0, 200),
        provider: this.providerId,
      };
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        item.resolved = {
          addressLine: d.slice(0, 500),
          city: pickCityFromOsmStyleAddress(r.address),
          latitude: lat,
          longitude: lon,
          sourceProvider: this.providerId,
          sourceReference: placeId,
        };
      }
      out.push(item);
    }
    return out;
  }

  async reverseFromCoordinates(
    latitude: number,
    longitude: number,
    _options: AddressProviderResolveOptions,
    requestTimeoutMs: number,
  ): Promise<CanonicalAddress> {
    if (!this.isConfigured()) {
      throw new BadRequestException({
        code: 'ADDRESS_NOM_KEY',
        message:
          'Nominatim user-agent (ADDRESS_NOMINATIM_USER_AGENT) is not set',
      });
    }
    const u = new URL(`${this.getBaseUrl()}/reverse`);
    u.searchParams.set('lat', String(latitude));
    u.searchParams.set('lon', String(longitude));
    u.searchParams.set('format', 'json');
    u.searchParams.set('addressdetails', '1');
    u.searchParams.set('zoom', '18');
    const res = await fetchWithTimeout(
      u.toString(),
      { method: 'GET', headers: this.headersJson() },
      requestTimeoutMs,
    );
    if (!res.ok) {
      if (isFallbackHttpStatus(res.status) || res.status === 404) {
        throw new BadRequestException({
          code: 'ADDRESS_PLACE_UNREACHABLE',
          message: 'Nominatim reverse failed',
        });
      }
      throw new Error(`nominatim reverse http ${res.status}`);
    }
    const raw = (await res.json()) as {
      error?: string;
      display_name?: string;
      address?: Record<string, string>;
      lat?: string;
      lon?: string;
      osm_id?: number;
      osm_type?: string;
    };
    if (raw.error != null && raw.error.length > 0) {
      throw new BadRequestException({
        code: 'ADDRESS_PLACE_NOT_FOUND',
        message: raw.error,
      });
    }
    const rOs = raw.osm_type;
    const rId = raw.osm_id;
    if (rId == null || rOs == null) {
      throw new BadRequestException({
        code: 'ADDRESS_NO_OSM_REF',
        message: 'Nominatim reverse: no OSM id',
      });
    }
    const t = rOs === 'node' || rOs === 'relation' ? rOs : 'way';
    const placeId = this.encodeOsmId(t, Number(rId));
    const lat = Number(raw.lat);
    const lon = Number(raw.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new BadRequestException({
        code: 'ADDRESS_NO_GEOMETRY',
        message: 'No coordinates',
      });
    }
    const addressLine = (raw.display_name ?? '').trim();
    if (!addressLine) {
      throw new BadRequestException({
        code: 'ADDRESS_NO_FORMATTED',
        message: 'No formatted address',
      });
    }
    return {
      addressLine: addressLine.slice(0, 500),
      city: pickCityFromOsmStyleAddress(raw.address),
      latitude: lat,
      longitude: lon,
      sourceProvider: this.providerId,
      sourceReference: placeId,
    };
  }

  async resolveByPlaceId(
    placeId: string,
    _options: AddressProviderResolveOptions,
    requestTimeoutMs: number,
  ): Promise<CanonicalAddress> {
    if (!this.isConfigured()) {
      throw new BadRequestException({
        code: 'ADDRESS_NOM_KEY',
        message:
          'Nominatim user-agent (ADDRESS_NOMINATIM_USER_AGENT) is not set',
      });
    }
    const { osmIds } = this.parseOsmId(placeId);
    const u = new URL(`${this.getBaseUrl()}/lookup`);
    u.searchParams.set('osm_ids', osmIds);
    u.searchParams.set('format', 'json');
    u.searchParams.set('addressdetails', '1');
    const res = await fetchWithTimeout(
      u.toString(),
      { method: 'GET', headers: this.headersJson() },
      requestTimeoutMs,
    );
    if (!res.ok) {
      if (isFallbackHttpStatus(res.status) || res.status === 404) {
        throw new BadRequestException({
          code: 'ADDRESS_PLACE_UNREACHABLE',
          message: 'Nominatim lookup failed',
        });
      }
      throw new Error(`nominatim http ${res.status}`);
    }
    const data = (await res.json()) as {
      place_id: number;
      osm_type: string;
      osm_id: number;
      display_name: string;
      address?: Record<string, string>;
      lat?: string;
      lon?: string;
    }[];
    const r = Array.isArray(data) ? data[0] : data;
    if (!r?.display_name) {
      throw new BadRequestException({
        code: 'ADDRESS_PLACE_NOT_FOUND',
        message: 'Place not found',
      });
    }
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new BadRequestException({
        code: 'ADDRESS_NO_GEOMETRY',
        message: 'No coordinates',
      });
    }
    return {
      addressLine: r.display_name.slice(0, 500),
      city: pickCityFromOsmStyleAddress(r.address),
      latitude: lat,
      longitude: lon,
      sourceProvider: this.providerId,
      sourceReference: placeId.trim(),
    };
  }
}
