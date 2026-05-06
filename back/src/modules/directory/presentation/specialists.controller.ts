import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import {
  JwtAccessOptionalGuard,
  type AuthenticatedUser,
} from '../../../common/guards';
import {
  ApiLocaleQueryDocs,
  RequestLocale,
  type ApiLocale,
} from '../../../common/i18n';
import {
  parseListCategorySlugsCsv,
  parseListBodyZoneSlugsCsv,
  parseListSearchQ,
  parseOptionalSpecialistGender,
  parseOptionalMajorCategorySlug,
  parseOptionalVndPriceRange,
} from '../../../common/pagination/directory-list-search-query.parse';
import { parseDirectoryListRadiusFromQuery } from '../../../common/pagination/parse-directory-list-radius.query';
import {
  DIRECTORY_LIST_DEFAULT_LIMIT,
  DIRECTORY_LIST_MAX_LIMIT,
  parseDirectoryListLimit,
} from '../../../common/pagination/parse-directory-list-limit';
import { parseDirectoryListSort } from '../../../common/pagination/directory-list-sort';
import { DirectoryService } from '../application/directory.service';
import type { DirectoryReviewsListResponseDto } from '../dto/directory-reviews-list-response.dto';
import type { SpecialistListItemDto } from '../dto/specialists-list-response.dto';
import type { SpecialistsListResponseDto } from '../dto/specialists-list-response.dto';
import {
  directoryReviewsListResponseSchema,
  specialistListItemSchema,
  specialistsListResponseSchema,
} from './directory.openapi-schemas';

type AuthedOrGuest = Request & { user?: AuthenticatedUser };

@ApiTags('directory-specialists')
@Controller('specialists')
export class SpecialistsController {
  constructor(private readonly directoryService: DirectoryService) {}

  @Get()
  @UseGuards(JwtAccessOptionalGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Список специалистов (курсорная пагинация)',
    description:
      'Активные профили специалистов (не удалённые). Сортировка: `sort` — `popularity` (по умолчанию, отзывы), `newest`, `rating`, `price_asc` / `price_desc`, `recommended` (релевантность по портрету; нужен Bearer и готовность персонализации). Вертикаль: `majorSlug`. Фильтры: `q`, `categories`, цена, радиус. `sort=recommended` требует валидный access token и доступность персонализации (как GET /personalization/recommendations).',
  })
  @ApiLocaleQueryDocs()
  @ApiQuery({
    name: 'sort',
    required: false,
    description:
      '`popularity` (по умолчанию), `recommended`, `newest`, `price_asc`, `price_desc`, `rating`.',
    schema: {
      type: 'string',
      enum: [
        'recommended',
        'popularity',
        'newest',
        'price_asc',
        'price_desc',
        'rating',
      ],
    },
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description:
      'Курсор (`cursorPage.nextCursor` с предыдущей страницы). Без параметра — первая страница. Должен соответствовать `sort` на том же списке.',
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
    name: 'bodyZones',
    required: false,
    description: 'Slug зон анатомии через запятую (для majorSlug=massage).',
    example: 'neck,back-upper',
  })
  @ApiQuery({
    name: 'gender',
    required: false,
    description: 'Фильтр пола специалиста: male или female. Без параметра — все.',
    schema: { type: 'string', enum: ['male', 'female'] },
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
    description:
      'Вместе с `radiusLat` / `radiusLng`: радиус в метрах (WGS-84), гео по активной организации.',
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
      'Неверный формат locale, limit, cursor, sort, majorSlug, categories, цены VND или радиуса',
  })
  async list(
    @RequestLocale() locale: ApiLocale,
    @Req() req: AuthedOrGuest,
    @Query('sort') sortRaw?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limitRaw?: string,
    @Query('majorSlug') majorSlugRaw?: string,
    @Query('q') qRaw?: string,
    @Query('categories') categoriesRaw?: string,
    @Query('bodyZones') bodyZonesRaw?: string,
    @Query('gender') genderRaw?: string,
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
    const priceFromQuery =
      priceMinVndRaw !== undefined || priceMaxVndRaw !== undefined;
    const radius = parseDirectoryListRadiusFromQuery(
      radiusMRaw,
      radiusLatRaw,
      radiusLngRaw,
    );
    return this.directoryService.listSpecialists(locale, {
      sort: parseDirectoryListSort(sortRaw),
      cursor: cursor ?? null,
      limit: parseDirectoryListLimit(limitRaw),
      majorCategorySlug: parseOptionalMajorCategorySlug(majorSlugRaw),
      q: parseListSearchQ(qRaw),
      categorySlugs: parseListCategorySlugsCsv(categoriesRaw),
      bodyZoneSlugs: parseListBodyZoneSlugsCsv(bodyZonesRaw),
      gender: parseOptionalSpecialistGender(genderRaw),
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
      userId: req.user?.id ?? null,
      priceFromQuery,
    });
  }

  @Get(':id/reviews')
  @UseGuards(JwtAccessOptionalGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Отзывы о специалисте',
    description:
      'Список `SpecialistReview` (курсор). Отдельно от отзывов о салоне (`OrganizationReview`).',
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'UUID специалиста',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiLocaleQueryDocs()
  @ApiQuery({
    name: 'cursor',
    required: false,
    description:
      'Курсор (`cursorPage.nextCursor`). Сортировка: сначала новые (`createdAt desc`, `id desc`).',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: `Размер страницы (1–${DIRECTORY_LIST_MAX_LIMIT}, по умолчанию ${DIRECTORY_LIST_DEFAULT_LIMIT}).`,
    schema: { type: 'integer', minimum: 1, maximum: DIRECTORY_LIST_MAX_LIMIT },
  })
  @ApiOkResponse({ schema: directoryReviewsListResponseSchema })
  @ApiNotFoundResponse({ description: 'Специалист не найден' })
  @ApiBadRequestResponse({
    description: 'Неверный формат locale, limit или cursor',
  })
  async listReviews(
    @Req() req: AuthedOrGuest,
    @Param('id', ParseUUIDPipe) id: string,
    @RequestLocale() locale: ApiLocale,
    @Query('cursor') cursor?: string,
    @Query('limit') limitRaw?: string,
  ): Promise<DirectoryReviewsListResponseDto> {
    const row = await this.directoryService.listSpecialistReviews(
      locale,
      id,
      {
        cursor: cursor ?? null,
        limit: parseDirectoryListLimit(limitRaw),
      },
      req.user?.id ?? null,
    );
    if (!row) {
      throw new NotFoundException({
        code: 'SPECIALIST_NOT_FOUND',
        message: 'Specialist not found',
      });
    }
    return row;
  }

  @Get(':id')
  @UseGuards(JwtAccessOptionalGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Специалист по id',
    description: 'Профиль мастера: те же поля, что в списке специалистов.',
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'UUID специалиста',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiLocaleQueryDocs()
  @ApiOkResponse({ schema: specialistListItemSchema })
  @ApiNotFoundResponse({ description: 'Специалист не найден' })
  @ApiBadRequestResponse({
    description: 'Неверный формат locale или id',
  })
  async getById(
    @Req() req: AuthedOrGuest,
    @Param('id', ParseUUIDPipe) id: string,
    @RequestLocale() locale: ApiLocale,
  ): Promise<SpecialistListItemDto> {
    const row = await this.directoryService.getSpecialistById(
      locale,
      id,
      req.user?.id ?? null,
    );
    if (!row) {
      throw new NotFoundException({
        code: 'SPECIALIST_NOT_FOUND',
        message: 'Specialist not found',
      });
    }
    return row;
  }
}
