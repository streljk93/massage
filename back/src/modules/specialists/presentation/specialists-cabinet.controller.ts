import {
  Body,
  Controller,
  Get,
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
import { SpecialistOnboardingService } from '../application/specialist-onboarding.service';
import { SpecialistWorkplaceService } from '../application/specialist-workplace.service';
import type { SpecialistActiveOrganizationBookingsPreviewQuery } from '../dto/specialist-active-organization-bookings-preview-query.schema';
import { specialistActiveOrganizationBookingsPreviewQuerySchema } from '../dto/specialist-active-organization-bookings-preview-query.schema';
import type { PatchSpecialistActiveOrganizationBody } from '../dto/patch-specialist-active-organization-body.schema';
import { patchSpecialistActiveOrganizationBodySchema } from '../dto/patch-specialist-active-organization-body.schema';
import type { SalonCabinetBookingsListQuery } from '../dto/salon-cabinet-bookings-list-query.schema';
import { salonCabinetBookingsListQuerySchema } from '../dto/salon-cabinet-bookings-list-query.schema';
import type { PatchSpecialistOnboardingPreferencesBody } from '../dto/patch-specialist-onboarding-preferences.schema';
import { patchSpecialistOnboardingPreferencesBodySchema } from '../dto/patch-specialist-onboarding-preferences.schema';
import type { PatchSpecialistSkillsBody } from '../dto/patch-specialist-skills-body.schema';
import { patchSpecialistSkillsBodySchema } from '../dto/patch-specialist-skills-body.schema';
import { patchSpecialistProfileBodySchema, type PatchSpecialistProfileBody } from '../dto/specialist-body.schema';
import {
  patchSpecialistActiveOrganizationRequestSchema,
  patchSpecialistActiveOrganizationResponseSchema,
  patchSpecialistOnboardingPreferencesRequestSchema,
  patchSpecialistProfileRequestSchema,
  patchSpecialistSkillsRequestSchema,
  specialistActiveOrganizationBookingsPreviewResponseSchema,
  specialistMyOrganizationsResponseSchema,
  specialistMyWorkplaceJoinRequestsResponseSchema,
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

  @Get('me/active-organization/bookings-preview')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiLocaleQueryDocs()
  @ApiQuery({
    name: 'organizationId',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description:
      'Текущее место приёма мастера; должно совпадать с `activeOrganizationId` в ответе `GET /specialists/me/organizations`.',
  })
  @ApiOperation({
    summary:
      'Превью активных броней к вам в текущей организации — то же, что будет отменено при смене места приёма.',
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

  @Patch('me/active-organization')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Текущая организация мастера (адрес витрины и новые записи). При переключении на другую организацию или снятии активного салона (в теле PATCH `organizationId`: uuid другой организации или null) активные брони на прежнем месте приёма отменяются.',
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
    description:
      'Профиль, навыки или организация не готовы',
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
