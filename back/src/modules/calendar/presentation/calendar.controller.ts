import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAccessGuard, type AuthenticatedUser } from '../../../common/guards';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CalendarService } from '../application/calendar.service';
import {
  calendarEventsQuerySchema,
  type CalendarEventsQuery,
} from '../dto/calendar-events-query.schema';
import {
  createCalendarBlockBodySchema,
  type CreateCalendarBlockBody,
} from '../dto/create-calendar-block-body.schema';
import {
  updateCalendarBlockBodySchema,
  type UpdateCalendarBlockBody,
} from '../dto/update-calendar-block-body.schema';
import {
  deleteCalendarBlockQuerySchema,
  type DeleteCalendarBlockQuery,
} from '../dto/delete-calendar-block-query.schema';
import {
  availabilityOverrideBodySchema,
  putAvailabilityRulesBulkBodySchema,
  putAvailabilityRulesBodySchema,
  type AvailabilityOverrideBody,
  type PutAvailabilityRulesBulkBody,
  type PutAvailabilityRulesBody,
} from '../dto/calendar-availability.schema';
import {
  availabilityOverrideRequestSchema,
  calendarEventsResponseSchema,
  calendarAvailabilityResponseSchema,
  calendarResourcesResponseSchema,
  createCalendarBlockRequestSchema,
  createCalendarBlockResponseSchema,
  putAvailabilityRulesBulkRequestSchema,
  putAvailabilityRulesBulkResponseSchema,
  putAvailabilityRulesRequestSchema,
  updateCalendarBlockRequestSchema,
} from './calendar.openapi-schemas';

type AuthedRequest = Request & { user: AuthenticatedUser };

@ApiTags('calendar')
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('resources')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Ресурсы календаря активной организации',
    description:
      'Возвращает ресурсы текущего контекста организации. В MVP — специалисты.',
  })
  @ApiOkResponse({ schema: calendarResourcesResponseSchema })
  @ApiUnauthorizedResponse({ description: 'Нет access token' })
  @ApiForbiddenResponse({ description: 'Нет доступа к активной организации' })
  async listResources(@Req() req: AuthedRequest) {
    return this.calendarService.listResources(req.user.id);
  }

  @Get('resources/:resourceId/availability')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Правила и исключения рабочего времени ресурса.' })
  @ApiParam({ name: 'resourceId', format: 'uuid' })
  @ApiOkResponse({ schema: calendarAvailabilityResponseSchema })
  async getResourceAvailability(
    @Req() req: AuthedRequest,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
  ) {
    return this.calendarService.getResourceAvailability(
      req.user.id,
      resourceId,
    );
  }

  @Put('resources/:resourceId/availability/rules')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Заменить недельные правила рабочего времени.' })
  @ApiParam({ name: 'resourceId', format: 'uuid' })
  @ApiBody({ schema: putAvailabilityRulesRequestSchema })
  @ApiOkResponse({ schema: calendarAvailabilityResponseSchema })
  async putResourceAvailabilityRules(
    @Req() req: AuthedRequest,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Body(new ZodValidationPipe(putAvailabilityRulesBodySchema))
    body: PutAvailabilityRulesBody,
  ) {
    return this.calendarService.replaceResourceAvailabilityRules(
      req.user.id,
      resourceId,
      body.rules,
    );
  }

  @Put('availability/rules/bulk')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Заменить недельные правила рабочего времени для ресурсов.',
    description:
      'Атомарно применяет один набор недельных правил к нескольким ресурсам календаря активной организации.',
  })
  @ApiBody({ schema: putAvailabilityRulesBulkRequestSchema })
  @ApiOkResponse({ schema: putAvailabilityRulesBulkResponseSchema })
  async putResourceAvailabilityRulesBulk(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(putAvailabilityRulesBulkBodySchema))
    body: PutAvailabilityRulesBulkBody,
  ) {
    return this.calendarService.replaceManyResourceAvailabilityRules(
      req.user.id,
      body.resourceIds,
      body.rules,
    );
  }

  @Post('resources/:resourceId/availability/overrides')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Создать разовое исключение рабочего времени.' })
  @ApiParam({ name: 'resourceId', format: 'uuid' })
  @ApiBody({ schema: availabilityOverrideRequestSchema })
  @ApiOkResponse({ schema: calendarAvailabilityResponseSchema })
  async createResourceAvailabilityOverride(
    @Req() req: AuthedRequest,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Body(new ZodValidationPipe(availabilityOverrideBodySchema))
    body: AvailabilityOverrideBody,
  ) {
    return this.calendarService.createResourceAvailabilityOverride(
      req.user.id,
      resourceId,
      body,
    );
  }

  @Patch('resources/:resourceId/availability/overrides/:overrideId')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Изменить разовое исключение рабочего времени.' })
  @ApiParam({ name: 'resourceId', format: 'uuid' })
  @ApiParam({ name: 'overrideId', format: 'uuid' })
  @ApiBody({ schema: availabilityOverrideRequestSchema })
  @ApiOkResponse({ schema: calendarAvailabilityResponseSchema })
  async patchResourceAvailabilityOverride(
    @Req() req: AuthedRequest,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Param('overrideId', ParseUUIDPipe) overrideId: string,
    @Body(new ZodValidationPipe(availabilityOverrideBodySchema))
    body: AvailabilityOverrideBody,
  ) {
    return this.calendarService.patchResourceAvailabilityOverride(
      req.user.id,
      resourceId,
      overrideId,
      body,
    );
  }

  @Delete('resources/:resourceId/availability/overrides/:overrideId')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Удалить разовое исключение рабочего времени.' })
  @ApiParam({ name: 'resourceId', format: 'uuid' })
  @ApiParam({ name: 'overrideId', format: 'uuid' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['id', 'deleted'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        deleted: { type: 'boolean', enum: [true] },
      },
    },
  })
  async deleteResourceAvailabilityOverride(
    @Req() req: AuthedRequest,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Param('overrideId', ParseUUIDPipe) overrideId: string,
  ) {
    return this.calendarService.deleteResourceAvailabilityOverride(
      req.user.id,
      resourceId,
      overrideId,
    );
  }

  @Get('events')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Окно событий календаря активной организации',
    description:
      'Window query: `startsAt < to AND endsAt > from`, с cursor pagination по `startsAt,id`.',
  })
  @ApiOkResponse({ schema: calendarEventsResponseSchema })
  @ApiQuery({ name: 'from', required: true, type: String })
  @ApiQuery({ name: 'to', required: true, type: String })
  @ApiQuery({
    name: 'resourceIds',
    required: false,
    isArray: true,
    type: String,
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiBadRequestResponse({ description: 'Невалидный query' })
  @ApiUnauthorizedResponse({ description: 'Нет access token' })
  @ApiForbiddenResponse({ description: 'Нет доступа к ресурсу' })
  async listEvents(
    @Req() req: AuthedRequest,
    @Query(new ZodValidationPipe(calendarEventsQuerySchema))
    query: CalendarEventsQuery,
  ) {
    return this.calendarService.listEvents(req.user.id, query);
  }

  @Post('events')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Создать служебный блок календаря',
    description:
      'Создаёт только `type=block`. Booking-события создаются исключительно через bookings use case.',
  })
  @ApiBody({ schema: createCalendarBlockRequestSchema })
  @ApiOkResponse({ schema: createCalendarBlockResponseSchema })
  @ApiBadRequestResponse({ description: 'Конфликт или невалидный интервал' })
  @ApiUnauthorizedResponse({ description: 'Нет access token' })
  @ApiForbiddenResponse({ description: 'Нет доступа к ресурсу' })
  async createBlock(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(createCalendarBlockBodySchema))
    body: CreateCalendarBlockBody,
  ) {
    return this.calendarService.createBlock(req.user.id, body);
  }

  @Patch('events/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Изменить служебный блок календаря',
    description:
      'Работает только с `type=block`. Booking-события меняются через bookings API.',
  })
  @ApiBody({ schema: updateCalendarBlockRequestSchema })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ schema: createCalendarBlockResponseSchema })
  @ApiBadRequestResponse({ description: 'Конфликт, booking-event или неверный интервал' })
  @ApiUnauthorizedResponse({ description: 'Нет access token' })
  @ApiForbiddenResponse({ description: 'Нет доступа к ресурсу' })
  async updateBlock(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateCalendarBlockBodySchema))
    body: UpdateCalendarBlockBody,
  ) {
    return this.calendarService.updateBlock(req.user.id, id, body);
  }

  @Delete('events/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Удалить служебный блок календаря',
    description: 'DELETE разрешён только для `type=block`; booking отменяется через bookings API.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['id', 'deleted'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        deleted: { type: 'boolean', enum: [true] },
      },
    },
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery({ name: 'version', required: true, type: Number })
  @ApiBadRequestResponse({ description: 'Попытка удалить booking-event' })
  @ApiUnauthorizedResponse({ description: 'Нет access token' })
  @ApiForbiddenResponse({ description: 'Нет доступа к событию' })
  async deleteBlock(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(deleteCalendarBlockQuerySchema))
    query: DeleteCalendarBlockQuery,
  ) {
    return this.calendarService.deleteBlock(req.user.id, id, query.version);
  }
}
