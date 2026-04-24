import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
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
import {
  parseListCategorySlugsCsv,
  parseListSearchQ,
  parseOptionalMajorCategorySlug,
  parseOptionalVndPriceRange,
} from '../../../common/pagination/directory-list-search-query.parse';
import { parseDirectoryListRadiusFromQuery } from '../../../common/pagination/parse-directory-list-radius.query';
import {
  DIRECTORY_LIST_DEFAULT_LIMIT,
  DIRECTORY_LIST_MAX_LIMIT,
  parseDirectoryListLimit,
} from '../../../common/pagination/parse-directory-list-limit';
import { DirectoryService } from '../application/directory.service';
import type { SpecialistListItemDto } from '../dto/specialists-list-response.dto';
import type { SpecialistsListResponseDto } from '../dto/specialists-list-response.dto';
import {
  specialistListItemSchema,
  specialistsListResponseSchema,
} from './directory.openapi-schemas';

@ApiTags('specialists')
@Controller('specialists')
export class SpecialistsController {
  constructor(private readonly directoryService: DirectoryService) {}

  @Get()
  @ApiOperation({
    summary: 'Список специалистов (курсорная пагинация)',
    description:
      'Активные профили специалистов (не удалённые). Имя — из `User.name`. Стабильная сортировка: `User.name` asc, затем `id` asc. Вертикаль: `majorSlug` (`MajorServiceCategory.slug`, напр. massage) — только мастера с подкатегориями в этой большой категории. Фильтры: `q`, `categories`, `priceMinVnd` / `priceMaxVnd`, `radiusM`+`radiusLat`+`radiusLng` (точка приёма = активный салон). Курсор — в том же наборе фильтров.',
  })
  @ApiLocaleQueryDocs()
  @ApiQuery({
    name: 'cursor',
    required: false,
    description:
      'Курсор (`cursorPage.nextCursor` с предыдущей страницы). Без параметра — первая страница.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: `Размер страницы (1–${DIRECTORY_LIST_MAX_LIMIT}, по умолчанию ${DIRECTORY_LIST_DEFAULT_LIMIT}).`,
    schema: { type: 'integer', minimum: 1, maximum: DIRECTORY_LIST_MAX_LIMIT },
  })
  @ApiQuery({
    name: 'majorSlug',
    required: false,
    description:
      'Slug большой категории (`MajorServiceCategory.slug`), напр. massage — ограничить вертикаль каталога.',
    example: 'massage',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description:
      'Поиск по имени, био, строкам витрины, адресу активной организации, названиям услуг и категориям.',
  })
  @ApiQuery({
    name: 'categories',
    required: false,
    description:
      'Slug подкатегорий каталога через запятую (мастер должен отмечен хотя бы одну).',
    example: 'neck,foot',
  })
  @ApiQuery({
    name: 'priceMinVnd',
    required: false,
    description:
      'Нижняя граница цены (VND) по личной услуге мастера; в паре с priceMaxVnd или отдельно.',
    schema: { type: 'integer', minimum: 0 },
  })
  @ApiQuery({
    name: 'priceMaxVnd',
    required: false,
    description: 'Верхняя граница цены (VND).',
    schema: { type: 'integer', minimum: 0 },
  })
  @ApiQuery({
    name: 'radiusM',
    required: false,
    description: 'Вместе с `radiusLat` / `radiusLng`: радиус в метрах (WGS-84), гео по активной организации.',
    schema: { type: 'integer', minimum: 50, maximum: 500_000 },
  })
  @ApiQuery({
    name: 'radiusLat',
    required: false,
    description: 'Широта центра круга (вместе с `radiusM`, `radiusLng`).',
  })
  @ApiQuery({
    name: 'radiusLng',
    required: false,
    description: 'Долгота центра круга (вместе с `radiusM`, `radiusLat`).',
  })
  @ApiOkResponse({ schema: specialistsListResponseSchema })
  @ApiBadRequestResponse({
    description:
      'Неверный формат locale, limit, cursor, majorSlug, categories, цены VND или радиуса',
  })
  async list(
    @RequestLocale() locale: ApiLocale,
    @Query('cursor') cursor?: string,
    @Query('limit') limitRaw?: string,
    @Query('majorSlug') majorSlugRaw?: string,
    @Query('q') qRaw?: string,
    @Query('categories') categoriesRaw?: string,
    @Query('priceMinVnd') priceMinVndRaw?: string,
    @Query('priceMaxVnd') priceMaxVndRaw?: string,
    @Query('radiusM') radiusMRaw?: string,
    @Query('radiusLat') radiusLatRaw?: string,
    @Query('radiusLng') radiusLngRaw?: string,
  ): Promise<SpecialistsListResponseDto> {
    const { priceMinVnd, priceMaxVnd } = parseOptionalVndPriceRange(
      priceMinVndRaw,
      priceMaxVndRaw,
    );
    const radius = parseDirectoryListRadiusFromQuery(
      radiusMRaw,
      radiusLatRaw,
      radiusLngRaw,
    );
    return this.directoryService.listSpecialists(locale, {
      cursor: cursor ?? null,
      limit: parseDirectoryListLimit(limitRaw),
      majorCategorySlug: parseOptionalMajorCategorySlug(majorSlugRaw),
      q: parseListSearchQ(qRaw),
      categorySlugs: parseListCategorySlugsCsv(categoriesRaw),
      priceMinVnd,
      priceMaxVnd,
      radius:
        radius == null
          ? null
          : {
              centerLat: radius.centerLat,
              centerLng: radius.centerLng,
              radiusM: radius.radiusM,
            },
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Специалист по id',
    description: 'Профиль мастера: те же поля, что в списке специалистов.',
  })
  @ApiLocaleQueryDocs()
  @ApiOkResponse({ schema: specialistListItemSchema })
  @ApiNotFoundResponse({ description: 'Специалист не найден' })
  @ApiBadRequestResponse({
    description: 'Неверный формат locale или id',
  })
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @RequestLocale() locale: ApiLocale,
  ): Promise<SpecialistListItemDto> {
    const row = await this.directoryService.getSpecialistById(locale, id);
    if (!row) {
      throw new NotFoundException({
        code: 'SPECIALIST_NOT_FOUND',
        message: 'Specialist not found',
      });
    }
    return row;
  }
}
