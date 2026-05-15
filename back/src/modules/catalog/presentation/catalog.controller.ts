import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseBoolPipe,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiLocaleQueryDocs,
  RequestLocale,
  type ApiLocale,
} from '../../../common/i18n';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CatalogService } from '../application/catalog.service';
import type {
  CatalogBulkCategoriesResponseDto,
  CatalogBodyZonesResponseDto,
  CatalogCategoriesResponseDto,
} from '../dto/catalog-categories-response.dto';
import type { CatalogCategoryDetailResponseDto } from '../dto/catalog-category-detail-response.dto';
import type { CatalogMajorCategoriesListResponseDto } from '../dto/catalog-major-categories-list-response.dto';
import {
  majorAndCategorySlugParamSchema,
  majorSlugParamSchema,
  type MajorAndCategorySlugParam,
  type MajorSlugParam,
} from '../dto/major-slug-param.schema';
import {
  catalogBulkCategoriesResponseSchema,
  catalogBodyZonesResponseSchema,
  catalogCategoriesResponseSchema,
  catalogCategoryDetailResponseSchema,
  catalogMajorCategoriesListResponseSchema,
  catalogMajorCategoryNotFoundSchema,
  catalogServiceCategoryNotFoundSchema,
} from './catalog.openapi-schemas';
import {
  catalogBulkCategoriesQuerySchema,
  type CatalogBulkCategoriesQuery,
} from '../dto/catalog-bulk-categories-query.schema';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('major-categories')
  @ApiOperation({
    summary: 'Все большие категории услуг',
    description:
      'Список активных больших категорий (вертикалей), отсортированных по sortOrder. Названия по query `locale` (en, vi, ru); при отсутствии перевода — fallback en, затем каноническое поле `name` сущности.',
  })
  @ApiLocaleQueryDocs()
  @ApiOkResponse({ schema: catalogMajorCategoriesListResponseSchema })
  @ApiBadRequestResponse({
    description: 'Неверный формат locale',
  })
  async getMajorCategories(
    @RequestLocale() locale: ApiLocale,
  ): Promise<CatalogMajorCategoriesListResponseDto> {
    return this.catalogService.getAllMajorServiceCategories(locale);
  }

  @Get('major-categories/bulk/categories')
  @ApiOperation({
    summary: 'Подкатегории по нескольким большим категориям (bulk)',
    description:
      'Параметр `majorSlugs` — список slug через запятую (например `massage,nail`). Порядок в ответе совпадает с порядком в запросе.',
    operationId: 'catalogGetBulkCategoriesByMajorSlugs',
  })
  @ApiQuery({
    name: 'majorSlugs',
    required: true,
    example: 'massage,nail',
    description: 'Slug больших категорий через запятую, без пробелов или с обрезкой пробелов.',
  })
  @ApiQuery({
    name: 'listedInDirectory',
    required: false,
    type: Boolean,
    description:
      'Если true — только подкатегории витрины (как у одиночного маршрута по major).',
  })
  @ApiLocaleQueryDocs()
  @ApiOkResponse({ schema: catalogBulkCategoriesResponseSchema })
  @ApiBadRequestResponse({
    description: 'Неверный формат majorSlugs или locale',
  })
  @ApiNotFoundResponse({
    description: 'Один из major slug не найден',
    schema: catalogMajorCategoryNotFoundSchema,
  })
  async getBulkCategoriesByMajorSlugs(
    @Query(new ZodValidationPipe(catalogBulkCategoriesQuerySchema))
    query: CatalogBulkCategoriesQuery,
    @RequestLocale() locale: ApiLocale,
  ): Promise<CatalogBulkCategoriesResponseDto> {
    return this.catalogService.getServiceCategoriesByMajorSlugsBulk(
      query.majorSlugs,
      locale,
      { listedInDirectory: query.listedInDirectory },
    );
  }

  @Get('major-categories/:majorSlug/body-zones')
  @ApiOperation({
    summary: 'Анатомические зоны по slug большой категории',
    description:
      'Возвращает активные BodyZone для вертикали (MVP: massage). Названия по query `locale` с fallback en/slug.',
  })
  @ApiParam({
    name: 'majorSlug',
    example: 'massage',
    description: 'Slug большой категории (MajorServiceCategory.slug)',
  })
  @ApiLocaleQueryDocs()
  @ApiOkResponse({ schema: catalogBodyZonesResponseSchema })
  @ApiNotFoundResponse({ schema: catalogMajorCategoryNotFoundSchema })
  @ApiBadRequestResponse({
    description: 'Неверный формат majorSlug или locale',
  })
  async getBodyZonesByMajorSlug(
    @Param(new ZodValidationPipe(majorSlugParamSchema))
    params: MajorSlugParam,
    @RequestLocale() locale: ApiLocale,
  ): Promise<CatalogBodyZonesResponseDto> {
    return this.catalogService.getBodyZonesByMajorSlug(
      params.majorSlug,
      locale,
    );
  }

  /** Более специфичный маршрут — объявляем до списка `.../categories`. */
  @Get('major-categories/:majorSlug/categories/:categorySlug')
  @ApiOperation({
    summary: 'Одна подкатегория по slug внутри большой категории',
    description:
      'Возвращает большую категорию и одну активную подкатегорию. Названия по query `locale` (en, vi, ru); при отсутствии перевода — fallback en, затем канонические поля сущности.',
  })
  @ApiParam({
    name: 'majorSlug',
    example: 'massage',
    description: 'Slug большой категории (MajorServiceCategory.slug)',
  })
  @ApiParam({
    name: 'categorySlug',
    example: 'neck',
    description: 'Slug подкатегории (ServiceCategory.slug внутри большой)',
  })
  @ApiLocaleQueryDocs()
  @ApiOkResponse({ schema: catalogCategoryDetailResponseSchema })
  @ApiNotFoundResponse({ schema: catalogServiceCategoryNotFoundSchema })
  @ApiBadRequestResponse({
    description: 'Неверный формат majorSlug, categorySlug или locale',
  })
  async getCategoryByMajorAndSlug(
    @Param(new ZodValidationPipe(majorAndCategorySlugParamSchema))
    params: MajorAndCategorySlugParam,
    @RequestLocale() locale: ApiLocale,
  ): Promise<CatalogCategoryDetailResponseDto> {
    return this.catalogService.getServiceCategoryByMajorAndSlug(
      params.majorSlug,
      params.categorySlug,
      locale,
    );
  }

  @Get('major-categories/:majorSlug/categories')
  @ApiOperation({
    summary: 'Подкатегории услуг по slug большой категории',
    description:
      'Возвращает большую категорию (например massage) и список активных подкатегорий (ServiceCategory), отсортированных по sortOrder. Названия подставляются по query `locale` (en, vi, ru); при отсутствии перевода — fallback en, затем канонические поля сущности.',
  })
  @ApiParam({
    name: 'majorSlug',
    example: 'massage',
    description: 'Slug большой категории (MajorServiceCategory.slug)',
  })
  @ApiQuery({
    name: 'listedInDirectory',
    required: false,
    type: Boolean,
    description:
      'Если true — только подкатегории, которые есть у мастеров витрины или у организаций в этой вертикали.',
  })
  @ApiLocaleQueryDocs()
  @ApiOkResponse({ schema: catalogCategoriesResponseSchema })
  @ApiNotFoundResponse({ schema: catalogMajorCategoryNotFoundSchema })
  @ApiBadRequestResponse({
    description:
      'Неверный формат majorSlug, locale или listedInDirectory (ожидается boolean)',
  })
  async getCategoriesByMajorSlug(
    @Param(new ZodValidationPipe(majorSlugParamSchema))
    params: MajorSlugParam,
    @RequestLocale() locale: ApiLocale,
    @Query('listedInDirectory', new DefaultValuePipe(false), ParseBoolPipe)
    listedInDirectory: boolean,
  ): Promise<CatalogCategoriesResponseDto> {
    return this.catalogService.getServiceCategoriesByMajorSlug(
      params.majorSlug,
      locale,
      { listedInDirectory },
    );
  }
}
