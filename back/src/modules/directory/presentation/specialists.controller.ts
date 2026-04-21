import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiLocaleQueryDocs,
  RequestLocale,
  type ApiLocale,
} from '../../../common/i18n';
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
    summary: 'Список всех специалистов',
    description:
      'Активные профили специалистов (не удалённые). Имя — из `User.name`. Сортировка по имени. Подкатегории каталога и строка услуг учитывают `?locale` (en, vi, ru).',
  })
  @ApiLocaleQueryDocs()
  @ApiOkResponse({ schema: specialistsListResponseSchema })
  @ApiBadRequestResponse({
    description: 'Неверный формат locale',
  })
  async list(
    @RequestLocale() locale: ApiLocale,
  ): Promise<SpecialistsListResponseDto> {
    return this.directoryService.listSpecialists(locale);
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
