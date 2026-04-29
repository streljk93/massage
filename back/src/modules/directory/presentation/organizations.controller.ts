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
  parseListSearchQ,
  parseOptionalMajorCategorySlug,
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
import type { OrganizationDetailResponseDto } from '../dto/organization-detail-response.dto';
import type { OrganizationsListResponseDto } from '../dto/organizations-list-response.dto';
import {
  directoryReviewsListResponseSchema,
  organizationDetailResponseSchema,
  organizationsListResponseSchema,
} from './directory.openapi-schemas';

type AuthedOrGuest = Request & { user?: AuthenticatedUser };

@ApiTags('directory-organizations')
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly directoryService: DirectoryService) {}

  @Get()
  @UseGuards(JwtAccessOptionalGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Список организаций (курсорная пагинация)',
    description:
      'Активные организации (салоны), не удалённые. Сортировка: `popularity` (по умолчанию), `recommended`, `newest`, `price_asc`, `price_desc`, `rating`. `recommended` — релевантность по портрету; нужен Bearer и готовность персонализации. Фильтры: `q`, `categories`, радиус.',
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
    description:
      'Вместе с `radiusLat` / `radiusLng`: радиус в метрах (WGS-84), фильтр на бэке.',
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
      'Неверный формат locale, limit, cursor, sort, majorSlug, categories или радиуса',
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
      sort: parseDirectoryListSort(sortRaw),
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
      userId: req.user?.id ?? null,
    });
  }

  @Get(':id/reviews')
  @UseGuards(JwtAccessOptionalGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Отзывы о салоне',
    description:
      'Список `OrganizationReview` для витрины (курсор). Отдельно от отзывов о мастерах (`SpecialistReview`).',
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'UUID организации (салона)',
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
  @ApiNotFoundResponse({ description: 'Организация не найдена' })
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
    const row = await this.directoryService.listOrganizationReviews(
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
        code: 'ORG_NOT_FOUND',
        message: 'Organization not found',
      });
    }
    return row;
  }

  @Get(':id')
  @UseGuards(JwtAccessOptionalGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Организация по id',
    description:
      'Карточка салона для профиля: те же поля, что в списке, плюс сотрудники (`staff`).',
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'UUID организации (салона)',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiLocaleQueryDocs()
  @ApiOkResponse({ schema: organizationDetailResponseSchema })
  @ApiNotFoundResponse({ description: 'Организация не найдена' })
  @ApiBadRequestResponse({
    description: 'Неверный формат locale или id',
  })
  async getById(
    @Req() req: AuthedOrGuest,
    @Param('id', ParseUUIDPipe) id: string,
    @RequestLocale() locale: ApiLocale,
  ): Promise<OrganizationDetailResponseDto> {
    const row = await this.directoryService.getOrganizationById(
      locale,
      id,
      req.user?.id ?? null,
    );
    if (!row) {
      throw new NotFoundException({
        code: 'ORG_NOT_FOUND',
        message: 'Organization not found',
      });
    }
    return row;
  }
}
