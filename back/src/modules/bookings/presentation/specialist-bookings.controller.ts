import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { JwtAccessGuard, type AuthenticatedUser } from '../../../common/guards';
import { BookingsService } from '../application/bookings.service';
import {
  specialistCancelConfirmedBookingBodySchema,
  type SpecialistCancelConfirmedBookingBody,
} from '../dto/specialist-cancel-confirmed-booking-body.schema';
import {
  specialistRescheduleConfirmedBookingBodySchema,
  type SpecialistRescheduleConfirmedBookingBody,
} from '../dto/specialist-reschedule-confirmed-booking-body.schema';
import {
  specialistCancelConfirmedBookingRequestSchema,
  specialistCancelConfirmedBookingResponseSchema,
  specialistConfirmBookingResponseSchema,
  specialistRejectPendingBookingResponseSchema,
  specialistRescheduleConfirmedBookingRequestSchema,
  specialistRescheduleConfirmedBookingResponseSchema,
  specialistStartVisitResponseSchema,
} from './bookings.openapi-schemas';

type AuthedRequest = Request & { user: AuthenticatedUser };

@ApiTags('bookings')
@Controller('bookings')
export class SpecialistBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post('me/:id/confirm')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Подтвердить запись (специалист / салон)',
    description:
      'Переводит `pending` → `confirmed` для брони, пишет историю, отправляет push клиенту. JWT — пользователь с профилем `Specialist`: либо принимающий мастер брони, либо owner/admin организации, указанной в брони.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ schema: specialistConfirmBookingResponseSchema })
  @ApiBadRequestResponse({
    description: 'Статус не `pending` (код `BOOKING_NOT_PENDING`)',
  })
  @ApiForbiddenResponse({
    description:
      'Нет профиля специалиста или нет права на эту бронь (`BOOKING_SALON_ACTION_FORBIDDEN`)',
  })
  @ApiNotFoundResponse({ description: 'Бронь не найдена' })
  @ApiUnauthorizedResponse({ description: 'Нет access token' })
  async confirmPending(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookingsService.confirmPendingBySpecialist(req.user.id, id);
  }

  @Post('me/:id/reject')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Отклонить ожидающую запись (мастер / салон)',
    description:
      '`pending` → `reject_by_master`, push клиенту. Доступ: принимающий мастер или owner/admin организации из брони.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ schema: specialistRejectPendingBookingResponseSchema })
  @ApiBadRequestResponse({
    description: 'Статус не `pending` (код `BOOKING_NOT_PENDING`)',
  })
  @ApiForbiddenResponse({
    description:
      'Нет профиля специалиста или нет права на эту бронь (`BOOKING_SALON_ACTION_FORBIDDEN`)',
  })
  @ApiNotFoundResponse({ description: 'Бронь не найдена' })
  @ApiUnauthorizedResponse({ description: 'Нет access token' })
  async rejectPending(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookingsService.rejectPendingBySpecialist(req.user.id, id);
  }

  @Post('me/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Отменить подтверждённую запись (мастер / салон)',
    description:
      '`confirmed` → `canceled_by_master`; причина и комментарий пишутся в бронь, push клиенту. Owner/admin салона может отменять запись любого принимающего мастера в своей организации.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ schema: specialistCancelConfirmedBookingRequestSchema })
  @ApiOkResponse({ schema: specialistCancelConfirmedBookingResponseSchema })
  @ApiBadRequestResponse({
    description:
      'Не `confirmed`, ошибка тела или `master_other` без комментария (`BOOKING_CANNOT_CANCEL`)',
  })
  @ApiForbiddenResponse({
    description:
      'Нет профиля специалиста или нет права на эту бронь (`BOOKING_SALON_ACTION_FORBIDDEN`)',
  })
  @ApiNotFoundResponse({ description: 'Бронь не найдена' })
  @ApiUnauthorizedResponse({ description: 'Нет access token' })
  async cancelConfirmed(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(specialistCancelConfirmedBookingBodySchema))
    body: SpecialistCancelConfirmedBookingBody,
  ) {
    return this.bookingsService.cancelConfirmedBySpecialist(
      req.user.id,
      id,
      body,
    );
  }

  @Post('me/:id/reschedule')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Перенести подтверждённую запись',
    description:
      'Только `confirmed`: добавляет `BookingEvent` типа `rescheduled`, обновляет `startsAt`/`endsAt` через проекцию, статус остаётся `confirmed`. Те же проверки сетки слота и пересечений, что при создании записи; клиенту — push и письмо о новом времени.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ schema: specialistRescheduleConfirmedBookingRequestSchema })
  @ApiOkResponse({ schema: specialistRescheduleConfirmedBookingResponseSchema })
  @ApiBadRequestResponse({
    description:
      'Не `confirmed`, слот занят, не по сетке, вне listing workday, в прошлом, или слишком близко к старту при включённой политике (`BOOKING_RESCHEDULE_*`)',
  })
  @ApiForbiddenResponse({
    description:
      'Нет профиля специалиста или нет права на эту бронь (`BOOKING_SALON_ACTION_FORBIDDEN`)',
  })
  @ApiNotFoundResponse({ description: 'Бронь не найдена' })
  @ApiUnauthorizedResponse({ description: 'Нет access token' })
  async rescheduleConfirmed(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(specialistRescheduleConfirmedBookingBodySchema))
    body: SpecialistRescheduleConfirmedBookingBody,
  ) {
    return this.bookingsService.rescheduleConfirmedBySpecialist(
      req.user.id,
      id,
      body,
    );
  }

  @Post('me/:id/start-visit')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Начать приём (in_progress)',
    description:
      'Переводит `confirmed` → `in_progress`. Допустимо не раньше `startsAt` (с допуском `BOOKING_START_TOLERANCE_MS`). Принимающий мастер или owner/admin организации из брони.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ schema: specialistStartVisitResponseSchema })
  @ApiBadRequestResponse({
    description:
      'Не `confirmed`, или слишком рано до `startsAt` (`BOOKING_CANNOT_START_VISIT`, `BOOKING_TOO_EARLY_FOR_IN_PROGRESS`)',
  })
  @ApiForbiddenResponse({
    description:
      'Нет профиля специалиста или нет права на эту бронь (`BOOKING_SALON_ACTION_FORBIDDEN`)',
  })
  @ApiNotFoundResponse({ description: 'Бронь не найдена' })
  @ApiUnauthorizedResponse({ description: 'Нет access token' })
  async startVisit(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookingsService.startVisitBySpecialist(req.user.id, id);
  }
}
