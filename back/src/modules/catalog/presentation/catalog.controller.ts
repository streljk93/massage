import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CatalogService } from '../application/catalog.service';
import type { CatalogCategoriesResponseDto } from '../dto/catalog-categories-response.dto';
import {
  majorSlugParamSchema,
  type MajorSlugParam,
} from '../dto/major-slug-param.schema';
import {
  catalogCategoriesResponseSchema,
  catalogMajorCategoryNotFoundSchema,
} from './catalog.openapi-schemas';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('major-categories/:majorSlug/categories')
  @ApiOperation({
    summary: 'Подкатегории услуг по slug большой категории',
    description:
      'Возвращает большую категорию (например massage) и список активных подкатегорий (ServiceCategory), отсортированных по sortOrder.',
  })
  @ApiParam({
    name: 'majorSlug',
    example: 'massage',
    description: 'Slug большой категории (MajorServiceCategory.slug)',
  })
  @ApiOkResponse({ schema: catalogCategoriesResponseSchema })
  @ApiNotFoundResponse({ schema: catalogMajorCategoryNotFoundSchema })
  @ApiBadRequestResponse({
    description: 'Неверный формат majorSlug (ожидается slug)',
  })
  async getCategoriesByMajorSlug(
    @Param(new ZodValidationPipe(majorSlugParamSchema))
    params: MajorSlugParam,
  ): Promise<CatalogCategoriesResponseDto> {
    return this.catalogService.getServiceCategoriesByMajorSlug(
      params.majorSlug,
    );
  }
}
