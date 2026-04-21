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
    summary: 'Список всех организаций',
    description:
      'Активные организации (салоны), не удалённые. Название и описание по query `locale` (en, vi, ru): запрошенная локаль → en → канонические поля сущности.',
  })
  @ApiLocaleQueryDocs()
  @ApiOkResponse({ schema: organizationsListResponseSchema })
  @ApiBadRequestResponse({
    description: 'Неверный формат locale',
  })
  async list(
    @RequestLocale() locale: ApiLocale,
  ): Promise<OrganizationsListResponseDto> {
    return this.directoryService.listOrganizations(locale);
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
