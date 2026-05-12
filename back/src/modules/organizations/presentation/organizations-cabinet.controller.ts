import {
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
  organizationCabinetTeamMembersResponseSchema,
  organizationTeamInviteCandidatesResponseSchema,
  organizationTeamInvitationListResponseSchema,
  organizationTeamInvitationMutationResponseSchema,
  organizationTeamInviteRequestSchema,
  organizationTeamInviteRespondRequestSchema,
  organizationTeamMutationResponseSchema,
  organizationTeamRoleRequestSchema,
  workplaceJoinApplicantCabinetProfileResponseSchema,
  workplaceJoinRequestListResponseSchema,
  workplaceJoinRequestReviewRequestSchema,
  workplaceJoinRequestReviewResponseSchema,
} from './organizations-cabinet.openapi-schemas';
import {
  organizationTeamRoleBodySchema,
  type OrganizationTeamRoleBody,
} from '../dto/organization-team-role.schema';
import {
  organizationTeamInviteBodySchema,
  organizationTeamInviteCandidatesQuerySchema,
  organizationTeamInviteRespondBodySchema,
  type OrganizationTeamInviteBody,
  type OrganizationTeamInviteCandidatesQuery,
  type OrganizationTeamInviteRespondBody,
} from '../dto/organization-team-invite.schema';
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

  @Get(':organizationId/cabinet-team')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Участники точки в кабинете (активное employment: специалист, имя, роль).',
    description:
      'Доступно владельцу записи организации в БД или любому мастеру с активным членством в точке.',
  })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiOkResponse({ schema: organizationCabinetTeamMembersResponseSchema })
  @ApiForbiddenResponse({
    description:
      'Пользователь не состоит в организации (NOT_ORGANIZATION_MEMBER)',
  })
  @ApiNotFoundResponse({ description: 'Организация не найдена' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async getCabinetOrganizationTeamMembers(
    @Req() req: AuthedRequest,
    @Param('organizationId', new ParseUUIDPipe({ version: '4' }))
    organizationId: string,
  ) {
    return this.organizationCabinet.listCabinetOrganizationTeamMembers(
      req.user.id,
      organizationId,
    );
  }

  @Get(':organizationId/cabinet-team/invite-candidates')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Поиск специалистов для прямого приглашения в команду организации.',
    description:
      'Кабинетный поиск по профилям специалистов, без требований публичной витрины, резюме или вакансии.',
  })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiQuery({
    name: 'q',
    required: true,
    description:
      'Поиск по имени пользователя, email или витринному имени мастера.',
    schema: { type: 'string', minLength: 2, maxLength: 80 },
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 20, default: 10 },
  })
  @ApiOkResponse({ schema: organizationTeamInviteCandidatesResponseSchema })
  @ApiBadRequestResponse({ description: 'Невалидный query (q/limit)' })
  @ApiForbiddenResponse({
    description: 'Нет прав приглашать специалистов в команду',
  })
  @ApiNotFoundResponse({ description: 'Организация не найдена' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async getCabinetOrganizationTeamInviteCandidates(
    @Req() req: AuthedRequest,
    @Param('organizationId', new ParseUUIDPipe({ version: '4' }))
    organizationId: string,
    @Query(new ZodValidationPipe(organizationTeamInviteCandidatesQuerySchema))
    query: OrganizationTeamInviteCandidatesQuery,
  ) {
    return this.organizationCabinet.listCabinetTeamInviteCandidates(
      req.user.id,
      organizationId,
      query,
    );
  }

  @Post(':organizationId/cabinet-team/invitations')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Пригласить специалиста в команду организации.',
    description:
      'Отдельный от найма поток членства: приглашение не связано с вакансией или резюме.',
  })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiBody({ schema: organizationTeamInviteRequestSchema })
  @ApiOkResponse({ schema: organizationTeamInvitationMutationResponseSchema })
  @ApiBadRequestResponse({ description: 'Невалидное тело приглашения' })
  @ApiConflictResponse({
    description: 'Специалист уже состоит в организации',
  })
  @ApiForbiddenResponse({
    description: 'Нет прав приглашать специалистов в команду',
  })
  @ApiNotFoundResponse({ description: 'Специалист или организация не найдены' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async postCabinetOrganizationTeamInvitation(
    @Req() req: AuthedRequest,
    @Param('organizationId', new ParseUUIDPipe({ version: '4' }))
    organizationId: string,
    @Body(new ZodValidationPipe(organizationTeamInviteBodySchema))
    body: OrganizationTeamInviteBody,
  ) {
    return this.organizationCabinet.createCabinetTeamInvitation(
      req.user.id,
      organizationId,
      body,
    );
  }

  @Patch(':organizationId/cabinet-team/:employmentId/role')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Сменить роль участника команды организации.',
    description:
      'Доступно только владельцу организации. Роль owner через этот endpoint не выдается.',
  })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiParam({ name: 'employmentId', format: 'uuid' })
  @ApiBody({ schema: organizationTeamRoleRequestSchema })
  @ApiOkResponse({ schema: organizationTeamMutationResponseSchema })
  @ApiForbiddenResponse({
    description: 'Нет прав менять роли или попытка изменить владельца',
  })
  @ApiNotFoundResponse({ description: 'Участник команды не найден' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async patchCabinetOrganizationTeamMemberRole(
    @Req() req: AuthedRequest,
    @Param('organizationId', new ParseUUIDPipe({ version: '4' }))
    organizationId: string,
    @Param('employmentId', new ParseUUIDPipe({ version: '4' }))
    employmentId: string,
    @Body(new ZodValidationPipe(organizationTeamRoleBodySchema))
    body: OrganizationTeamRoleBody,
  ) {
    return this.organizationCabinet.patchCabinetOrganizationTeamMemberRole(
      req.user.id,
      organizationId,
      employmentId,
      body,
    );
  }

  @Delete(':organizationId/cabinet-team/:employmentId')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Деактивировать участника команды организации.',
    description:
      'Доступно только владельцу организации. Владельца нельзя удалить через team API.',
  })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiParam({ name: 'employmentId', format: 'uuid' })
  @ApiOkResponse({ schema: organizationTeamMutationResponseSchema })
  @ApiForbiddenResponse({
    description: 'Нет прав удалить участника или попытка удалить владельца',
  })
  @ApiNotFoundResponse({ description: 'Участник команды не найден' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async deleteCabinetOrganizationTeamMember(
    @Req() req: AuthedRequest,
    @Param('organizationId', new ParseUUIDPipe({ version: '4' }))
    organizationId: string,
    @Param('employmentId', new ParseUUIDPipe({ version: '4' }))
    employmentId: string,
  ) {
    return this.organizationCabinet.deleteCabinetOrganizationTeamMember(
      req.user.id,
      organizationId,
      employmentId,
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

@ApiTags('cabinet-specialists-organizations')
@Controller('specialists/me/organization-invitations')
export class SpecialistOrganizationInvitationsController {
  constructor(
    private readonly organizationCabinet: OrganizationCabinetService,
  ) {}

  @Get()
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Приглашения текущего специалиста в команды организаций.',
  })
  @ApiOkResponse({ schema: organizationTeamInvitationListResponseSchema })
  @ApiForbiddenResponse({
    description: 'У пользователя нет профиля специалиста',
  })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async listMyOrganizationInvitations(@Req() req: AuthedRequest) {
    return this.organizationCabinet.listMyOrganizationTeamInvitations(
      req.user.id,
    );
  }

  @Post(':invitationId/respond')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Ответить на приглашение организации: принять или отклонить.',
  })
  @ApiParam({
    name: 'invitationId',
    required: true,
    description: 'Идентификатор `OrganizationSpecialistInvitation`.',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiBody({ schema: organizationTeamInviteRespondRequestSchema })
  @ApiOkResponse({ schema: organizationTeamInvitationMutationResponseSchema })
  @ApiBadRequestResponse({ description: 'Невалидное тело ответа' })
  @ApiConflictResponse({ description: 'Приглашение истекло' })
  @ApiForbiddenResponse({
    description: 'У пользователя нет профиля специалиста',
  })
  @ApiNotFoundResponse({ description: 'Приглашение не найдено' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async respondMyOrganizationInvitation(
    @Req() req: AuthedRequest,
    @Param('invitationId', new ParseUUIDPipe({ version: '4' }))
    invitationId: string,
    @Body(new ZodValidationPipe(organizationTeamInviteRespondBodySchema))
    body: OrganizationTeamInviteRespondBody,
  ) {
    return this.organizationCabinet.respondMyOrganizationTeamInvitation(
      req.user.id,
      invitationId,
      body,
    );
  }
}
