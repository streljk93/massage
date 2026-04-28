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

function nwrFromOsmType(osmType: string | undefined): 'N' | 'R' | 'W' {
  if (osmType === 'node') {
    return 'N';
  }
  if (osmType === 'relation') {
    return 'R';
  }
  return 'W';
}

/**
 * Autocomplete + Lookup, см. https://locationiq.com/docs
 */
@Injectable()
export class LocationIqAddressHttpService implements AddressSearchProviderPort {
  private readonly log = new Logger(LocationIqAddressHttpService.name);
  readonly providerId: AddressProviderId = 'locationiq';
  private readonly base = 'https://api.locationiq.com/v1';

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return this.getKey().length > 0;
  }

  private getKey(): string {
    return (
      this.config.get<string>('address.locationiq.apiKey', '')?.trim() ?? ''
    );
  }

  private encodePlaceId(
    osmType: string | undefined,
    osmId: string | number,
  ): string {
    const p = nwrFromOsmType(osmType);
    return `liq:${p}${osmId}`;
  }

  private parsePlaceId(raw: string): {
    osmType: 'node' | 'way' | 'relation';
    id: string;
  } {
    const t = raw.trim();
    if (!t.startsWith('liq:')) {
      throw new BadRequestException({
        code: 'ADDRESS_LIQ_BAD_PLACE',
        message: 'Invalid LocationIQ place id',
      });
    }
    const rest = t.slice(4);
    const c = rest[0];
    if (c === 'N' || c === 'R' || c === 'W') {
      const type = c === 'N' ? 'node' : c === 'R' ? 'relation' : 'way';
      return { osmType: type, id: rest.slice(1) };
    }
    throw new BadRequestException({
      code: 'ADDRESS_LIQ_BAD_PLACE',
      message: 'Invalid LocationIQ place id',
    });
  }

  private osmIdsParam(
    osmType: 'node' | 'way' | 'relation',
    id: string,
  ): string {
    const p = nwrFromOsmType(osmType);
    return `${p}${id}`;
  }

  async getSuggestions(
    query: string,
    _options: AddressProviderResolveOptions,
    requestTimeoutMs: number,
  ): Promise<readonly AddressSuggestionItem[]> {
    const key = this.getKey();
    if (!key) {
      return [];
    }
    const q = query.trim();
    if (q.length < 2) {
      return [];
    }
    const u = new URL(`${this.base}/autocomplete`);
    u.searchParams.set('key', key);
    u.searchParams.set('q', q);
    u.searchParams.set('limit', '5');
    u.searchParams.set('dedupe', '1');
    let res: Response;
    try {
      res = await fetchWithTimeout(
        u.toString(),
        { method: 'GET' },
        requestTimeoutMs,
      );
    } catch {
      return [];
    }
    if (!res.ok) {
      if (isFallbackHttpStatus(res.status)) {
        this.log.debug(`autocomplete http ${res.status}`);
      } else {
        this.log.warn(`autocomplete http ${res.status}`);
      }
      return [];
    }
    const data = (await res.json()) as unknown;
    let list: unknown[] = Array.isArray(data) ? data : [];
    if (
      list.length === 0 &&
      data &&
      typeof data === 'object' &&
      data !== null &&
      'display_name' in data
    ) {
      list = [data];
    }
    const out: AddressSuggestionItem[] = [];
    for (const r of list) {
      if (!r || typeof r !== 'object') {
        continue;
      }
      const o = r as {
        display_place?: string;
        display_address?: string;
        display_name?: string;
        address?: Record<string, string>;
        lat?: string | number;
        lon?: string | number;
        osm_id?: string | number;
        osm_type?: string;
        osmId?: string | number;
        osmType?: string;
      };
      const osmId = o.osm_id ?? o.osmId;
      const osmType = o.osm_type ?? o.osmType;
      if (osmId == null) {
        continue;
      }
      const main = (o.display_place ?? o.address?.name ?? o.display_name ?? '')
        .toString()
        .trim();
      if (main.length < 1) {
        continue;
      }
      const placeId = this.encodePlaceId(String(osmType), osmId);
      const displayFull = (o.display_name ?? o.display_address ?? main)
        .toString()
        .trim();
      const lat = o.lat != null && o.lat !== '' ? Number(o.lat) : Number.NaN;
      const lon = o.lon != null && o.lon !== '' ? Number(o.lon) : Number.NaN;
      const item: AddressSuggestionItem = {
        placeId,
        mainText: main,
        secondaryText: (o.display_address ?? o.display_name ?? '')
          .toString()
          .trim()
          .slice(0, 200),
        provider: this.providerId,
      };
      if (
        Number.isFinite(lat) &&
        Number.isFinite(lon) &&
        displayFull.length > 1
      ) {
        item.resolved = {
          addressLine: displayFull.slice(0, 500),
          city: pickCityFromOsmStyleAddress(o.address),
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
    const key = this.getKey();
    if (!key) {
      throw new BadRequestException({
        code: 'ADDRESS_LIQ_KEY',
        message: 'LocationIQ is not configured',
      });
    }
    const u = new URL(`${this.base}/reverse.php`);
    u.searchParams.set('key', key);
    u.searchParams.set('lat', String(latitude));
    u.searchParams.set('lon', String(longitude));
    u.searchParams.set('format', 'json');
    u.searchParams.set('addressdetails', '1');
    const res = await fetchWithTimeout(
      u.toString(),
      { method: 'GET' },
      requestTimeoutMs,
    );
    if (!res.ok) {
      if (isFallbackHttpStatus(res.status) || res.status === 404) {
        throw new BadRequestException({
          code: 'ADDRESS_PLACE_UNREACHABLE',
          message: 'LocationIQ reverse failed',
        });
      }
      throw new Error(`locationiq reverse http ${res.status}`);
    }
    const row = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string>;
      lat?: string | number;
      lon?: string | number;
      osm_id?: string | number;
      osm_type?: string;
      osmId?: string | number;
      osmType?: string;
      error?: string;
    };
    if (row.error != null && row.error.length > 0) {
      throw new BadRequestException({
        code: 'ADDRESS_PLACE_NOT_FOUND',
        message: row.error,
      });
    }
    const osmId = row.osm_id ?? row.osmId;
    const osmType = row.osm_type ?? row.osmType;
    if (osmId == null || osmType == null) {
      throw new BadRequestException({
        code: 'ADDRESS_NO_OSM_REF',
        message: 'LocationIQ reverse: no OSM id',
      });
    }
    const placeId = this.encodePlaceId(String(osmType), osmId);
    const lat = Number(row.lat);
    const lon = Number(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new BadRequestException({
        code: 'ADDRESS_NO_GEOMETRY',
        message: 'No coordinates',
      });
    }
    const addressLine = (row.display_name ?? '').trim();
    if (!addressLine) {
      throw new BadRequestException({
        code: 'ADDRESS_NO_FORMATTED',
        message: 'No formatted address',
      });
    }
    return {
      addressLine: addressLine.slice(0, 500),
      city: pickCityFromOsmStyleAddress(row.address),
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
    const key = this.getKey();
    if (!key) {
      throw new BadRequestException({
        code: 'ADDRESS_LIQ_KEY',
        message: 'LocationIQ is not configured',
      });
    }
    const { osmType, id } = this.parsePlaceId(placeId);
    const u = new URL(`${this.base}/lookup`);
    u.searchParams.set('key', key);
    u.searchParams.set('osm_ids', this.osmIdsParam(osmType, id));
    u.searchParams.set('format', 'json');
    u.searchParams.set('addressdetails', '1');
    const res = await fetchWithTimeout(
      u.toString(),
      { method: 'GET' },
      requestTimeoutMs,
    );
    if (!res.ok) {
      if (isFallbackHttpStatus(res.status) || res.status === 404) {
        throw new BadRequestException({
          code: 'ADDRESS_PLACE_UNREACHABLE',
          message: 'LocationIQ lookup failed',
        });
      }
      throw new Error(`locationiq lookup http ${res.status}`);
    }
    const data = (await res.json()) as unknown;
    let row: unknown;
    if (Array.isArray(data)) {
      row = data[0];
    } else {
      row = data;
    }
    if (!row || typeof row !== 'object') {
      throw new BadRequestException({
        code: 'ADDRESS_PLACE_NOT_FOUND',
        message: 'Place not found',
      });
    }
    const b = row as {
      display_name?: string;
      address?: Record<string, string>;
      lat?: string | number;
      lon?: string | number;
    };
    const lat = Number(b.lat);
    const lon = Number(b.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new BadRequestException({
        code: 'ADDRESS_NO_GEOMETRY',
        message: 'No coordinates',
      });
    }
    const addressLine = (b.display_name ?? '').trim();
    if (!addressLine) {
      throw new BadRequestException({
        code: 'ADDRESS_NO_FORMATTED',
        message: 'No formatted address',
      });
    }
    return {
      addressLine: addressLine.slice(0, 500),
      city: pickCityFromOsmStyleAddress(b.address),
      latitude: lat,
      longitude: lon,
      sourceProvider: this.providerId,
      sourceReference: placeId.trim(),
    };
  }
}
