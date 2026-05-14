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
import { BookingsService } from '../../bookings/application/bookings.service';
import { SpecialistCabinetProfileService } from '../application/specialist-cabinet-profile.service';
import { SpecialistOnboardingService } from '../application/specialist-onboarding.service';
import { SpecialistWorkplaceService } from '../application/specialist-workplace.service';
import type { SpecialistActiveOrganizationBookingsPreviewQuery } from '../dto/specialist-active-organization-bookings-preview-query.schema';
import { specialistActiveOrganizationBookingsPreviewQuerySchema } from '../dto/specialist-active-organization-bookings-preview-query.schema';
import type { PatchSpecialistActiveOrganizationBody } from '../dto/patch-specialist-active-organization-body.schema';
import { patchSpecialistActiveOrganizationBodySchema } from '../dto/patch-specialist-active-organization-body.schema';
import type {
  CreateSpecialistWorkplaceBody,
  PatchSpecialistProfileStateBody,
  PatchSpecialistWorkplaceBody,
} from '../dto/specialist-workplace.schema';
import {
  createSpecialistWorkplaceBodySchema,
  patchSpecialistProfileStateBodySchema,
  patchSpecialistWorkplaceBodySchema,
} from '../dto/specialist-workplace.schema';
import type { SalonCabinetBookingsListQuery } from '../dto/salon-cabinet-bookings-list-query.schema';
import { salonCabinetBookingsListQuerySchema } from '../dto/salon-cabinet-bookings-list-query.schema';
import type { SpecialistCabinetClientsListQuery } from '../dto/specialist-cabinet-clients-list-query.schema';
import {
  SPECIALIST_CABINET_CLIENTS_SORT_VALUES,
  specialistCabinetClientsListQuerySchema,
} from '../dto/specialist-cabinet-clients-list-query.schema';
import type { PatchSpecialistOnboardingPreferencesBody } from '../dto/patch-specialist-onboarding-preferences.schema';
import { patchSpecialistOnboardingPreferencesBodySchema } from '../dto/patch-specialist-onboarding-preferences.schema';
import type { PatchSpecialistSkillsBody } from '../dto/patch-specialist-skills-body.schema';
import { patchSpecialistSkillsBodySchema } from '../dto/patch-specialist-skills-body.schema';
import {
  patchSpecialistProfileBodySchema,
  type PatchSpecialistProfileBody,
} from '../dto/specialist-body.schema';
import {
  patchSpecialistActiveOrganizationRequestSchema,
  patchSpecialistActiveOrganizationResponseSchema,
  patchSpecialistProfileStateRequestSchema,
  patchSpecialistProfileStateResponseSchema,
  patchSpecialistWorkplaceRequestSchema,
  patchSpecialistOnboardingPreferencesRequestSchema,
  patchSpecialistProfileRequestSchema,
  patchSpecialistSkillsRequestSchema,
  createSpecialistWorkplaceRequestSchema,
  specialistMyWorkplacesResponseSchema,
  specialistWorkplaceResponseSchema,
  specialistActiveOrganizationBookingsPreviewResponseSchema,
  specialistCabinetClientsListResponseSchema,
  specialistMyOrganizationsResponseSchema,
  specialistMyWorkplaceJoinRequestsResponseSchema,
  specialistCabinetProfileResponseSchema,
  specialistOnboardingResponseSchema,
  specialistSalonBookingsListResponseSchema,
} from './specialists.openapi-schemas';

type AuthedRequest = Request & { user: AuthenticatedUser };

/**
 * Кабинет мастера по текущему пользователю (JWT).
 * Публичная витрина — `GET /specialists`, `GET /specialists/:id` в модуле directory;
 * здесь — сегмент `me`, чтобы не пересекаться с UUID в `:id`.
 */
@ApiTags('cabinet-specialists')
@Controller('specialists')
export class SpecialistsCabinetController {
  constructor(
    private readonly specialistWorkplaceService: SpecialistWorkplaceService,
    private readonly specialistCabinetProfileService: SpecialistCabinetProfileService,
    private readonly specialistOnboardingService: SpecialistOnboardingService,
    private readonly bookingsService: BookingsService,
  ) {}

  @Get('me/organizations')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Организации мастера: активные членства и салоны с поданной заявкой на вступление (pending). Отмечается текущее место приёма.',
  })
  @ApiOkResponse({ schema: specialistMyOrganizationsResponseSchema })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async getSpecialistMyOrganizations(@Req() req: AuthedRequest) {
    return this.specialistWorkplaceService.listMyOrganizations(req.user.id);
  }

  @Get('me/workplaces')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Места приёма мастера и флаг “работаю как специалист”. Витрина опирается на active workplace, не на activeOrganizationId.',
  })
  @ApiOkResponse({ schema: specialistMyWorkplacesResponseSchema })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  @ApiNotFoundResponse({ description: 'Нет профиля специалиста' })
  async getSpecialistMyWorkplaces(@Req() req: AuthedRequest) {
    return this.specialistWorkplaceService.getMyWorkplaces(req.user.id);
  }

  @Post('me/workplaces')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Добавить организацию как место приёма. Требует активное трудоустройство в организации.',
  })
  @ApiBody({ schema: createSpecialistWorkplaceRequestSchema })
  @ApiOkResponse({ schema: specialistWorkplaceResponseSchema })
  @ApiBadRequestResponse({ description: 'Нет активного трудоустройства' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  @ApiNotFoundResponse({ description: 'Нет профиля специалиста' })
  async createSpecialistWorkplace(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(createSpecialistWorkplaceBodySchema))
    body: CreateSpecialistWorkplaceBody,
  ) {
    return this.specialistWorkplaceService.createWorkplace(req.user.id, body);
  }

  @Patch('me/profile-state')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Включить или выключить работу как специалист. Пересчитывает persisted visibility projection.',
  })
  @ApiBody({ schema: patchSpecialistProfileStateRequestSchema })
  @ApiOkResponse({ schema: patchSpecialistProfileStateResponseSchema })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  @ApiNotFoundResponse({ description: 'Нет профиля специалиста' })
  async patchSpecialistProfileState(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(patchSpecialistProfileStateBodySchema))
    body: PatchSpecialistProfileStateBody,
  ) {
    return this.specialistWorkplaceService.patchProfileState(req.user.id, body);
  }

  @Get('me/active-organization/bookings-preview')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiLocaleQueryDocs()
  @ApiQuery({
    name: 'organizationId',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description:
      'Организация активного `SpecialistWorkplace`; должна совпадать с текущим местом приёма.',
  })
  @ApiOperation({
    summary: 'Превью активных броней к вам в активной организации приёма.',
  })
  @ApiOkResponse({
    schema: specialistActiveOrganizationBookingsPreviewResponseSchema,
  })
  @ApiBadRequestResponse({
    description:
      'organizationId не совпадает с текущим местом приёма (NOT_CURRENT_ACTIVE_WORKPLACE_ORGANIZATION)',
  })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  @ApiNotFoundResponse({ description: 'Нет профиля специалиста' })
  async getSpecialistActiveOrganizationBookingsPreview(
    @Req() req: AuthedRequest,
    @Query(
      new ZodValidationPipe(
        specialistActiveOrganizationBookingsPreviewQuerySchema,
      ),
    )
    query: SpecialistActiveOrganizationBookingsPreviewQuery,
  ) {
    return this.specialistWorkplaceService.previewBookingsWhenLeavingActiveOrganization(
      req.user.id,
      query.organizationId,
      query.locale,
    );
  }

  @Get('me/workplace-join-requests')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Заявки текущего мастера на вступление в организации (отправленные из кабинета).',
  })
  @ApiOkResponse({ schema: specialistMyWorkplaceJoinRequestsResponseSchema })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async getSpecialistMyWorkplaceJoinRequests(@Req() req: AuthedRequest) {
    return this.specialistWorkplaceService.listMyWorkplaceJoinRequests(
      req.user.id,
    );
  }

  @Get('me/salon-bookings')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiLocaleQueryDocs()
  @ApiQuery({
    name: 'scope',
    required: true,
    schema: {
      type: 'string',
      enum: ['managed', 'active_workplace'],
    },
    description:
      'managed — записи по всем организациям, где мастер owner/admin. active_workplace — текущее место приёма: owner/admin видят все визиты этой организации, specialist — только свои брони в ней.',
  })
  @ApiOperation({
    summary:
      'Список броней для бизнес-экрана: либо все управляемые точки (managed), либо контекст текущего места приёма (active_workplace).',
  })
  @ApiOkResponse({ schema: specialistSalonBookingsListResponseSchema })
  @ApiBadRequestResponse({ description: 'Невалидный query' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  @ApiNotFoundResponse({ description: 'Нет профиля специалиста' })
  async getSpecialistSalonBookings(
    @Req() req: AuthedRequest,
    @Query(new ZodValidationPipe(salonCabinetBookingsListQuerySchema))
    query: SalonCabinetBookingsListQuery,
  ) {
    return this.bookingsService.listSalonCabinetBusiness(
      req.user.id,
      query.scope,
      query.locale,
    );
  }

  @Get('me/clients')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiLocaleQueryDocs()
  @ApiQuery({
    name: 'q',
    required: false,
    schema: { type: 'string', minLength: 1, maxLength: 120 },
    description: 'Поиск по отображаемому имени клиента.',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    schema: {
      type: 'string',
      enum: [...SPECIALIST_CABINET_CLIENTS_SORT_VALUES],
      default: 'lastBookingDesc',
    },
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    schema: { type: 'string', pattern: '^\\d+$' },
    description: 'Курсор следующей страницы из `nextCursor`.',
  })
  @ApiOperation({
    summary:
      'Клиенты текущего места приёма: owner/admin видят всю организацию, specialist — только своих клиентов.',
  })
  @ApiOkResponse({ schema: specialistCabinetClientsListResponseSchema })
  @ApiBadRequestResponse({ description: 'Невалидный query' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  @ApiNotFoundResponse({ description: 'Нет профиля специалиста' })
  async getSpecialistCabinetClients(
    @Req() req: AuthedRequest,
    @Query(new ZodValidationPipe(specialistCabinetClientsListQuerySchema))
    query: SpecialistCabinetClientsListQuery,
  ) {
    return this.bookingsService.listSpecialistCabinetClients(
      req.user.id,
      query,
    );
  }

  @Patch('me/active-organization')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Выбранная организация в кабинете мастера. Это UI-контекст; витрина и новые записи опираются на SpecialistWorkplace.',
  })
  @ApiBody({ schema: patchSpecialistActiveOrganizationRequestSchema })
  @ApiOkResponse({ schema: patchSpecialistActiveOrganizationResponseSchema })
  @ApiBadRequestResponse({
    description: 'Нет активного членства в организации',
  })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  @ApiNotFoundResponse({
    description: 'Нет профиля специалиста или организация не найдена',
  })
  async patchSpecialistActiveOrganization(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(patchSpecialistActiveOrganizationBodySchema))
    body: PatchSpecialistActiveOrganizationBody,
  ) {
    return this.specialistWorkplaceService.setActiveOrganization(
      req.user.id,
      body,
    );
  }

  @Post('me/ensure')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Создать профиль специалиста, если ещё нет (без привязки к организации, не в витрине).',
  })
  @ApiLocaleQueryDocs()
  @ApiOkResponse({ schema: specialistOnboardingResponseSchema })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async postEnsureSpecialist(
    @Req() req: AuthedRequest,
    @RequestLocale() locale: ApiLocale,
  ) {
    await this.specialistOnboardingService.ensureSpecialist(req.user.id);
    return this.specialistOnboardingService.getOnboarding(req.user.id, locale);
  }

  @Get('me/cabinet-profile')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Снимок профиля мастера для кабинета (витрина, навыки, контакты). Без шага онбординга.',
  })
  @ApiLocaleQueryDocs()
  @ApiOkResponse({ schema: specialistCabinetProfileResponseSchema })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async getSpecialistCabinetProfile(
    @Req() req: AuthedRequest,
    @RequestLocale() locale: ApiLocale,
  ) {
    return this.specialistCabinetProfileService.getCabinetProfile(
      req.user.id,
      locale,
    );
  }

  @Get('me/onboarding')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Состояние онбординга мастера (шаги 1→13, терминально 6).',
  })
  @ApiLocaleQueryDocs()
  @ApiOkResponse({ schema: specialistOnboardingResponseSchema })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async getSpecialistOnboarding(
    @Req() req: AuthedRequest,
    @RequestLocale() locale: ApiLocale,
  ) {
    return this.specialistOnboardingService.getOnboarding(req.user.id, locale);
  }

  @Patch('me/onboarding/preferences')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Онбординг: режим работы, большие категории и/или навыки (подкатегории без цены).',
  })
  @ApiLocaleQueryDocs()
  @ApiBody({
    schema: patchSpecialistOnboardingPreferencesRequestSchema,
  })
  @ApiOkResponse({ schema: specialistOnboardingResponseSchema })
  @ApiConflictResponse({
    description:
      'Онбординг завершён, или нельзя менять режим/сферы после привязки к организации',
  })
  @ApiBadRequestResponse({
    description:
      'Невалидные slug больших категорий, подкатегории навыков или несовпадение с доступными сферами',
  })
  @ApiNotFoundResponse({ description: 'Профиля специалиста нет' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async patchSpecialistOnboardingPreferences(
    @Req() req: AuthedRequest,
    @RequestLocale() locale: ApiLocale,
    @Body(new ZodValidationPipe(patchSpecialistOnboardingPreferencesBodySchema))
    body: PatchSpecialistOnboardingPreferencesBody,
  ) {
    return this.specialistOnboardingService.patchOnboardingPreferences(
      req.user.id,
      body,
      locale,
    );
  }

  @Patch('me/profile')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Поля профиля мастера: био, фото, опыт, массаж и т.д.',
  })
  @ApiBody({ schema: patchSpecialistProfileRequestSchema })
  @ApiOkResponse({ schema: specialistOnboardingResponseSchema })
  @ApiNotFoundResponse({ description: 'Профиля специалиста нет' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async patchSpecialistProfile(
    @Req() req: AuthedRequest,
    @RequestLocale() locale: ApiLocale,
    @Body(new ZodValidationPipe(patchSpecialistProfileBodySchema))
    body: PatchSpecialistProfileBody,
  ) {
    return this.specialistOnboardingService.patchProfile(
      req.user.id,
      body,
      locale,
    );
  }

  @Post('me/onboarding/complete')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Завершить онбординг после шага 13 (место работы и хотя бы один навык — подкатегория).',
  })
  @ApiOkResponse({ schema: specialistOnboardingResponseSchema })
  @ApiConflictResponse({
    description: 'Профиль, навыки или организация не готовы',
  })
  @ApiNotFoundResponse({ description: 'Профиля специалиста нет' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async postSpecialistOnboardingComplete(
    @Req() req: AuthedRequest,
    @RequestLocale() locale: ApiLocale,
  ) {
    return this.specialistOnboardingService.completeOnboarding(
      req.user.id,
      locale,
    );
  }

  @Patch('me/skills')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Кабинет: полная замена навыков мастера (подкатегории каталога без цены).',
  })
  @ApiLocaleQueryDocs()
  @ApiBody({ schema: patchSpecialistSkillsRequestSchema })
  @ApiOkResponse({ schema: specialistOnboardingResponseSchema })
  @ApiBadRequestResponse({ description: 'Недопустимые категории или сферы' })
  @ApiNotFoundResponse({ description: 'Профиля специалиста нет' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async patchSpecialistCabinetSkills(
    @Req() req: AuthedRequest,
    @RequestLocale() locale: ApiLocale,
    @Body(new ZodValidationPipe(patchSpecialistSkillsBodySchema))
    body: PatchSpecialistSkillsBody,
  ) {
    return this.specialistOnboardingService.patchCabinetSkills(
      req.user.id,
      body,
      locale,
    );
  }
}

@ApiTags('cabinet-specialist-workplaces')
@Controller('workplaces')
export class SpecialistWorkplacesController {
  constructor(
    private readonly specialistWorkplaceService: SpecialistWorkplaceService,
  ) {}

  @Patch(':workplaceId')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Изменить место приёма текущего мастера.' })
  @ApiParam({ name: 'workplaceId', schema: { type: 'string', format: 'uuid' } })
  @ApiBody({ schema: patchSpecialistWorkplaceRequestSchema })
  @ApiOkResponse({ schema: specialistWorkplaceResponseSchema })
  @ApiConflictResponse({
    description: 'Нельзя деактивировать место с активными бронями',
  })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  @ApiNotFoundResponse({ description: 'Место приёма не найдено' })
  async patchSpecialistWorkplace(
    @Req() req: AuthedRequest,
    @Param('workplaceId', new ParseUUIDPipe()) workplaceId: string,
    @Body(new ZodValidationPipe(patchSpecialistWorkplaceBodySchema))
    body: PatchSpecialistWorkplaceBody,
  ) {
    return this.specialistWorkplaceService.patchWorkplace(
      req.user.id,
      workplaceId,
      body,
    );
  }

  @Post(':workplaceId/activate')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Сделать место приёма активным. В транзакции снимает активность с остальных мест.',
  })
  @ApiParam({ name: 'workplaceId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ schema: specialistWorkplaceResponseSchema })
  @ApiConflictResponse({
    description: 'Параллельная активация или инвариант БД',
  })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  @ApiNotFoundResponse({ description: 'Место приёма не найдено' })
  async activateSpecialistWorkplace(
    @Req() req: AuthedRequest,
    @Param('workplaceId', new ParseUUIDPipe()) workplaceId: string,
  ) {
    return this.specialistWorkplaceService.activateWorkplace(
      req.user.id,
      workplaceId,
    );
  }

  @Post(':workplaceId/deactivate')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Выключить место приёма. Проверяет активные брони и инвариант последнего активного места.',
  })
  @ApiParam({ name: 'workplaceId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ schema: specialistWorkplaceResponseSchema })
  @ApiConflictResponse({
    description:
      'Нельзя деактивировать место с активными бронями или последнее активное место',
  })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  @ApiNotFoundResponse({ description: 'Место приёма не найдено' })
  async deactivateSpecialistWorkplace(
    @Req() req: AuthedRequest,
    @Param('workplaceId', new ParseUUIDPipe()) workplaceId: string,
  ) {
    return this.specialistWorkplaceService.deactivateWorkplace(
      req.user.id,
      workplaceId,
    );
  }

  @Delete(':workplaceId')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Удалить место приёма текущего мастера.' })
  @ApiParam({ name: 'workplaceId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['ok'],
      properties: { ok: { type: 'boolean', enum: [true] } },
    },
  })
  @ApiConflictResponse({
    description:
      'Нельзя удалить место с активными бронями или последнее активное место',
  })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  @ApiNotFoundResponse({ description: 'Место приёма не найдено' })
  async deleteSpecialistWorkplace(
    @Req() req: AuthedRequest,
    @Param('workplaceId', new ParseUUIDPipe()) workplaceId: string,
  ) {
    return this.specialistWorkplaceService.deleteWorkplace(
      req.user.id,
      workplaceId,
    );
  }
}
