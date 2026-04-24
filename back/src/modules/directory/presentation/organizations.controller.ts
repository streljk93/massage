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
} from '../../../common/pagination/directory-list-search-query.parse';
import { parseDirectoryListRadiusFromQuery } from '../../../common/pagination/parse-directory-list-radius.query';
import {
  DIRECTORY_LIST_DEFAULT_LIMIT,
  DIRECTORY_LIST_MAX_LIMIT,
  parseDirectoryListLimit,
} from '../../../common/pagination/parse-directory-list-limit';
import { DirectoryService } from '../application/directory.service';
import type { OrganizationDetailResponseDto } from '../dto/organization-detail-response.dto';
import type { OrganizationsListResponseDto } from '../dto/organizations-list-response.dto';
import {
  organizationDetailResponseSchema,
  organizationsListResponseSchema,
} from './directory.openapi-schemas';

@ApiTags('organizations')
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly directoryService: DirectoryService) {}

  @Get()
  @ApiOperation({
    summary: 'Список организаций (курсорная пагинация)',
    description:
      'Активные организации (салоны), не удалённые. Стабильная сортировка: `name` asc, затем `id` asc. Вертикаль: `majorSlug` (большая категория). Фильтры: `q`, `categories`, `radiusM`+`radiusLat`+`radiusLng` (круг на Земле, метры). Курсор — в том же наборе фильтров.',
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
      'Slug большой категории (`MajorServiceCategory.slug`), напр. massage.',
    example: 'massage',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description:
      'Поиск по названию, slug, адресу, строкам витрины, локализованным полям, услугам и категориям.',
  })
  @ApiQuery({
    name: 'categories',
    required: false,
    description:
      'Slug подкатегорий через запятую (салон должен отмечен хотя бы одну).',
    example: 'neck,foot',
  })
  @ApiQuery({
    name: 'radiusM',
    required: false,
    description: 'Вместе с `radiusLat` / `radiusLng`: радиус в метрах (WGS-84), фильтр на бэке.',
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
  @ApiOkResponse({ schema: organizationsListResponseSchema })
  @ApiBadRequestResponse({
    description:
      'Неверный формат locale, limit, cursor, majorSlug, categories или радиуса',
  })
  async list(
    @RequestLocale() locale: ApiLocale,
    @Query('cursor') cursor?: string,
    @Query('limit') limitRaw?: string,
    @Query('majorSlug') majorSlugRaw?: string,
    @Query('q') qRaw?: string,
    @Query('categories') categoriesRaw?: string,
    @Query('radiusM') radiusMRaw?: string,
    @Query('radiusLat') radiusLatRaw?: string,
    @Query('radiusLng') radiusLngRaw?: string,
  ): Promise<OrganizationsListResponseDto> {
    const radius = parseDirectoryListRadiusFromQuery(
      radiusMRaw,
      radiusLatRaw,
      radiusLngRaw,
    );
    return this.directoryService.listOrganizations(locale, {
      cursor: cursor ?? null,
      limit: parseDirectoryListLimit(limitRaw),
      majorCategorySlug: parseOptionalMajorCategorySlug(majorSlugRaw),
      q: parseListSearchQ(qRaw),
      categorySlugs: parseListCategorySlugsCsv(categoriesRaw),
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
    summary: 'Организация по id',
    description:
      'Карточка салона для профиля: те же поля, что в списке, плюс сотрудники (`staff`).',
  })
  @ApiLocaleQueryDocs()
  @ApiOkResponse({ schema: organizationDetailResponseSchema })
  @ApiNotFoundResponse({ description: 'Организация не найдена' })
  @ApiBadRequestResponse({
    description: 'Неверный формат locale или id',
  })
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @RequestLocale() locale: ApiLocale,
  ): Promise<OrganizationDetailResponseDto> {
    const row = await this.directoryService.getOrganizationById(locale, id);
    if (!row) {
      throw new NotFoundException({
        code: 'ORG_NOT_FOUND',
        message: 'Organization not found',
      });
    }
    return row;
  }
}
