import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiLocaleQueryDocs,
  RequestLocale,
  type ApiLocale,
} from '../../../common/i18n';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CatalogService } from '../application/catalog.service';
import type { CatalogCategoriesResponseDto } from '../dto/catalog-categories-response.dto';
import type { CatalogCategoryDetailResponseDto } from '../dto/catalog-category-detail-response.dto';
import {
  majorAndCategorySlugParamSchema,
  majorSlugParamSchema,
  type MajorAndCategorySlugParam,
  type MajorSlugParam,
} from '../dto/major-slug-param.schema';
import {
  catalogCategoriesResponseSchema,
  catalogCategoryDetailResponseSchema,
  catalogMajorCategoryNotFoundSchema,
  catalogServiceCategoryNotFoundSchema,
} from './catalog.openapi-schemas';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

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
  @ApiLocaleQueryDocs()
  @ApiOkResponse({ schema: catalogCategoriesResponseSchema })
  @ApiNotFoundResponse({ schema: catalogMajorCategoryNotFoundSchema })
  @ApiBadRequestResponse({
    description: 'Неверный формат majorSlug или locale',
  })
  async getCategoriesByMajorSlug(
    @Param(new ZodValidationPipe(majorSlugParamSchema))
    params: MajorSlugParam,
    @RequestLocale() locale: ApiLocale,
  ): Promise<CatalogCategoriesResponseDto> {
    return this.catalogService.getServiceCategoriesByMajorSlug(
      params.majorSlug,
      locale,
    );
  }
}
