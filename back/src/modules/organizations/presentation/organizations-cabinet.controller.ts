import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { JwtAccessGuard, type AuthenticatedUser } from '../../../common/guards';
import {
  ApiLocaleQueryDocs,
  RequestLocale,
  type ApiLocale,
} from '../../../common/i18n';
import { OrganizationCabinetService } from '../application/organization-cabinet.service';
import {
  createOrganizationBodySchema,
  type CreateOrganizationBody,
} from '../dto/create-organization-body.schema';
import {
  workplaceJoinRequestListQuerySchema,
  workplaceJoinRequestReviewBodySchema,
  type WorkplaceJoinRequestListQuery,
  type WorkplaceJoinRequestReviewBody,
} from '../dto/workplace-join-request.schema';
import {
  createOrganizationRequestSchema,
  organizationCabinetDeleteBookingsPreviewResponseSchema,
  organizationCabinetDeleteOrganizationResponseSchema,
  organizationCabinetEditProfileResponseSchema,
  workplaceJoinApplicantCabinetProfileResponseSchema,
  workplaceJoinRequestListResponseSchema,
  workplaceJoinRequestReviewRequestSchema,
  workplaceJoinRequestReviewResponseSchema,
} from './organizations-cabinet.openapi-schemas';
import { specialistOnboardingResponseSchema } from '../../specialists/presentation/specialists.openapi-schemas';

type AuthedRequest = Request & { user: AuthenticatedUser };

@ApiTags('cabinet-organizations')
@Controller('organizations')
export class OrganizationsCabinetController {
  constructor(
    private readonly organizationCabinet: OrganizationCabinetService,
  ) {}

  /**
   * Реализация: {@link OrganizationsController.getWorkplaceOrganizationSearch} (тот же URI), —
   * см. комментарий там: статический путь должен объявляться **до** `:id` на префиксе `organizations`.
   */

  @Post()
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Создать салон (текущий пользователь = владелец в БД), локаль витрины, подкатегории, членство owner.',
    description:
      'Требует Bearer. Если у мастера уже выбрано активное место приёма, оно не меняется; новый салон создаётся как дополнительное владение. Публичный список салонов — `GET /organizations`. В ответе — актуальное состояние онбординга мастера.',
  })
  @ApiLocaleQueryDocs()
  @ApiBody({ schema: createOrganizationRequestSchema })
  @ApiOkResponse({ schema: specialistOnboardingResponseSchema })
  @ApiBadRequestResponse({ description: 'Категории или валидация тела' })
  @ApiNotFoundResponse({ description: 'Профиля специалиста нет' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async postCreateOrganization(
    @Req() req: AuthedRequest,
    @RequestLocale() locale: ApiLocale,
    @Body(new ZodValidationPipe(createOrganizationBodySchema))
    body: CreateOrganizationBody,
  ) {
    return this.organizationCabinet.createOrganizationAsOwner(
      req.user.id,
      body,
      locale,
    );
  }

  @Get(':organizationId/cabinet-edit')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Поля салона для формы редактирования (владелец БД или активный admin).',
    description:
      'В отличие от публичного `GET /organizations/:id`, доступно админам орг без статуса `approved` по витрине.',
  })
  @ApiLocaleQueryDocs()
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiOkResponse({ schema: organizationCabinetEditProfileResponseSchema })
  @ApiForbiddenResponse({
    description: 'Нет прав управлять салоном (NOT_ORGANIZATION_MANAGER)',
  })
  @ApiNotFoundResponse({ description: 'Организация не найдена' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async getCabinetOrganizationProfileForEdit(
    @Req() req: AuthedRequest,
    @RequestLocale() locale: ApiLocale,
    @Param('organizationId', new ParseUUIDPipe({ version: '4' }))
    organizationId: string,
  ) {
    return this.organizationCabinet.getCabinetOrganizationProfileForEdit(
      req.user.id,
      organizationId,
      locale,
    );
  }

  @Get(':organizationId/delete-bookings-preview')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiLocaleQueryDocs()
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiOperation({
    summary:
      'Превью активных записей салона перед удалением организации владельцем.',
    description:
      'Тот же тип списка, что при смене места приёма для одного мастера, но по всей организации; плюс имя принимающего специалиста.',
  })
  @ApiOkResponse({
    schema: organizationCabinetDeleteBookingsPreviewResponseSchema,
  })
  @ApiForbiddenResponse({
    description: 'Только владелец организации (NOT_ORGANIZATION_OWNER)',
  })
  @ApiNotFoundResponse({ description: 'Организация не найдена' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async getDeleteOrganizationBookingsPreview(
    @Req() req: AuthedRequest,
    @RequestLocale() locale: ApiLocale,
    @Param('organizationId', new ParseUUIDPipe({ version: '4' }))
    organizationId: string,
  ) {
    return this.organizationCabinet.previewDeleteOrganizationBookings(
      req.user.id,
      organizationId,
      locale,
    );
  }

  @Delete(':organizationId')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiOperation({
    summary:
      'Удалить организацию из кабинета (soft delete): только владелец платформенной записи салона.',
    description:
      'Активные записи отменяются, услуги салона архивируются, членства и заявки в штат закрываются.',
  })
  @ApiOkResponse({
    schema: organizationCabinetDeleteOrganizationResponseSchema,
  })
  @ApiForbiddenResponse({
    description: 'Только владелец организации (NOT_ORGANIZATION_OWNER)',
  })
  @ApiNotFoundResponse({ description: 'Организация не найдена' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async deleteOrganizationAsOwner(
    @Req() req: AuthedRequest,
    @Param('organizationId', new ParseUUIDPipe({ version: '4' }))
    organizationId: string,
  ) {
    return this.organizationCabinet.deleteOrganizationAsOwner(
      req.user.id,
      organizationId,
    );
  }

  @Patch(':organizationId')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Обновить профиль салона (витрина, адрес, категории, галерея); новая ревизия — модерация.',
    description:
      'Тело как у `POST /organizations`. Slug салона не меняется. При смене сфер деятельности каталог салона под категории витрины перестраивается по текущим сферам; строки услуг мастеров не включаются/выключаются автоматически.',
  })
  @ApiLocaleQueryDocs()
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiBody({ schema: createOrganizationRequestSchema })
  @ApiOkResponse({ schema: specialistOnboardingResponseSchema })
  @ApiBadRequestResponse({ description: 'Категории или валидация тела' })
  @ApiForbiddenResponse({
    description: 'Нет прав управлять салоном (NOT_ORGANIZATION_MANAGER)',
  })
  @ApiNotFoundResponse({ description: 'Организация не найдена' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async patchOrganization(
    @Req() req: AuthedRequest,
    @RequestLocale() locale: ApiLocale,
    @Param('organizationId', new ParseUUIDPipe({ version: '4' }))
    organizationId: string,
    @Body(new ZodValidationPipe(createOrganizationBodySchema))
    body: CreateOrganizationBody,
  ) {
    return this.organizationCabinet.patchOrganizationAsManager(
      req.user.id,
      organizationId,
      body,
      locale,
    );
  }

  @Post(':organizationId/workplace-requests')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Подать заявку на работу в салоне; членство — после решения владельца или админа.',
  })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiOkResponse({ schema: specialistOnboardingResponseSchema })
  @ApiConflictResponse({
    description:
      'Уже активный член этой организации (ALREADY_ORGANIZATION_MEMBER)',
  })
  @ApiNotFoundResponse({
    description: 'Профиля специалиста или организации нет',
  })
  @ApiForbiddenResponse({
    description:
      'Организация заблокировала заявки от этого мастера (WORKPLACE_JOIN_BLOCKED)',
  })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async postRequestWorkplaceJoin(
    @Req() req: AuthedRequest,
    @Param('organizationId', new ParseUUIDPipe({ version: '4' }))
    organizationId: string,
  ) {
    return this.organizationCabinet.requestWorkplaceJoin(
      req.user.id,
      organizationId,
    );
  }

  @Get(':organizationId/workplace-join-requests')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Заявки мастеров в салон (владелец организации или мастер owner/admin).',
    description:
      'По умолчанию только status=pending; передайте status=all для полного списка.',
  })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'rejected', 'blocked', 'accepted', 'withdrawn', 'all'],
  })
  @ApiOkResponse({ schema: workplaceJoinRequestListResponseSchema })
  @ApiBadRequestResponse({ description: 'Невалидный query (status)' })
  @ApiForbiddenResponse({
    description: 'Нет прав управлять заявками (NOT_ORGANIZATION_MANAGER)',
  })
  @ApiNotFoundResponse({ description: 'Организация не найдена' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async getWorkplaceJoinRequestsForOrganization(
    @Req() req: AuthedRequest,
    @Param('organizationId', new ParseUUIDPipe({ version: '4' }))
    organizationId: string,
    @Query(new ZodValidationPipe(workplaceJoinRequestListQuerySchema))
    query: WorkplaceJoinRequestListQuery,
  ) {
    return this.organizationCabinet.listWorkplaceJoinRequestsForOrganization(
      req.user.id,
      organizationId,
      query,
    );
  }

  @Get(
    ':organizationId/workplace-join-applicants/:specialistId/cabinet-profile',
  )
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Профиль мастера для решения по заявке (как экран «Мой профиль» в кабинете мастера).',
    description:
      'Доступно только при наличии **pending** заявки этого мастера в указанную организацию; иначе 404.',
  })
  @ApiLocaleQueryDocs()
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiParam({ name: 'specialistId', format: 'uuid' })
  @ApiOkResponse({
    schema: workplaceJoinApplicantCabinetProfileResponseSchema,
  })
  @ApiForbiddenResponse({
    description: 'Нет прав управлять заявками (NOT_ORGANIZATION_MANAGER)',
  })
  @ApiNotFoundResponse({
    description:
      'Организация, заявка или профиль мастера не найдены (WORKPLACE_JOIN_REQUEST_NOT_FOUND и др.)',
  })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async getWorkplaceJoinApplicantCabinetProfile(
    @Req() req: AuthedRequest,
    @RequestLocale() locale: ApiLocale,
    @Param('organizationId', new ParseUUIDPipe({ version: '4' }))
    organizationId: string,
    @Param('specialistId', new ParseUUIDPipe({ version: '4' }))
    specialistId: string,
  ) {
    return this.organizationCabinet.getWorkplaceJoinApplicantCabinetProfile(
      req.user.id,
      organizationId,
      specialistId,
      locale,
    );
  }

  @Post(':organizationId/workplace-join-requests/:requestId/review')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Решение по заявке: принять, отклонить или заблокировать повторные заявки от мастера.',
  })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiParam({ name: 'requestId', format: 'uuid' })
  @ApiBody({ schema: workplaceJoinRequestReviewRequestSchema })
  @ApiOkResponse({ schema: workplaceJoinRequestReviewResponseSchema })
  @ApiBadRequestResponse({ description: 'Невалидное тело (decision)' })
  @ApiForbiddenResponse({
    description: 'Нет прав управлять заявками (NOT_ORGANIZATION_MANAGER)',
  })
  @ApiNotFoundResponse({
    description: 'Нет pending-заявки (WORKPLACE_JOIN_REQUEST_NOT_FOUND и др.)',
  })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async postReviewWorkplaceJoinRequest(
    @Req() req: AuthedRequest,
    @Param('organizationId', new ParseUUIDPipe({ version: '4' }))
    organizationId: string,
    @Param('requestId', new ParseUUIDPipe({ version: '4' })) requestId: string,
    @Body(new ZodValidationPipe(workplaceJoinRequestReviewBodySchema))
    body: WorkplaceJoinRequestReviewBody,
  ) {
    return this.organizationCabinet.reviewWorkplaceJoinRequest(
      req.user.id,
      organizationId,
      requestId,
      body,
    );
  }
}
