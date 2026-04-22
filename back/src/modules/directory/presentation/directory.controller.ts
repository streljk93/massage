import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiLocaleQueryDocs,
  RequestLocale,
  type ApiLocale,
} from '../../../common/i18n';
import { DirectoryService } from '../application/directory.service';
import type { CatalogFilterOptionsResponseDto } from '../dto/catalog-filter-options-response.dto';
import { catalogFilterOptionsResponseSchema } from './directory.openapi-schemas';

const CATALOG_TABS = ['organizations', 'specialists'] as const;
type CatalogTab = (typeof CATALOG_TABS)[number];

function parseCatalogTabParam(raw: string | undefined): CatalogTab {
  if (raw && (CATALOG_TABS as readonly string[]).includes(raw)) {
    return raw as CatalogTab;
  }
  throw new BadRequestException({
    code: 'INVALID_CATALOG_FILTER_TAB',
    message: 'Query "tab" must be "organizations" or "specialists".',
  });
}

@ApiTags('directory')
@Controller('directory')
export class DirectoryController {
  constructor(private readonly directoryService: DirectoryService) {}

  @Get('catalog-filter-options')
  @ApiOperation({
    summary: 'Опции фильтра каталога (поиск / карта)',
    description:
      'Подкатегории и (если есть) min/max VND-цен в базе для выбранного типа витрины. Используется в модалке фильтра при `?tab=...&locale=...`.',
  })
  @ApiQuery({
    name: 'tab',
    required: true,
    enum: CATALOG_TABS,
    description: 'Витрина: салоны (organizations) или мастера (specialists).',
  })
  @ApiLocaleQueryDocs()
  @ApiOkResponse({ schema: catalogFilterOptionsResponseSchema })
  @ApiBadRequestResponse({
    description: 'Неверные tab или locale',
  })
  async getCatalogFilterOptions(
    @Query('tab') tabRaw: string,
    @RequestLocale() locale: ApiLocale,
  ): Promise<CatalogFilterOptionsResponseDto> {
    const tab = parseCatalogTabParam(tabRaw);
    return this.directoryService.getCatalogFilterOptions(locale, tab);
  }
}
