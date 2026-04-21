import { Injectable } from '@nestjs/common';
import type { ApiLocale } from '../../../common/i18n';
import { resolveLocalizedString } from '../../../common/i18n/locale-table.resolver';
import type { AdvertisementsListResponseDto } from '../dto/advertisements-list-response.dto';
import {
  type AdvertisementWithLocales,
  AdvertisingRepository,
} from '../infrastructure/advertising.repository';

@Injectable()
export class AdvertisingService {
  constructor(private readonly advertisingRepository: AdvertisingRepository) {}

  async listByPlacement(
    placement: string,
    locale: ApiLocale,
  ): Promise<AdvertisementsListResponseDto> {
    const rows =
      await this.advertisingRepository.findActiveByPlacement(placement);
    return {
      placement,
      items: rows.map((row) => this.toItem(row, locale)),
    };
  }

  private toItem(
    row: AdvertisementWithLocales,
    locale: ApiLocale,
  ): AdvertisementsListResponseDto['items'][number] {
    const locs = row.locales;
    return {
      id: row.id,
      ownerKind: row.ownerKind === 'external' ? 'external' : 'internal',
      sortOrder: row.sortOrder,
      imageUrl: row.imageUrl,
      targetUrl: row.targetUrl,
      title: resolveLocalizedString(locale, locs, (l) => l.title, row.title),
      subtitle: resolveLocalizedString(
        locale,
        locs,
        (l) => l.subtitle,
        row.subtitle,
      ),
      ctaLabel: resolveLocalizedString(
        locale,
        locs,
        (l) => l.ctaLabel,
        row.ctaLabel,
      ),
    };
  }
}
