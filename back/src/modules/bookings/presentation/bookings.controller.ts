import {
  Body,
  Controller,
  Get,
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
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import {
  ApiLocaleQueryDocs,
  RequestLocale,
  type ApiLocale,
} from '../../../common/i18n';
import { JwtAccessGuard, type AuthenticatedUser } from '../../../common/guards';
import { BookingsService } from '../application/bookings.service';
import {
  createBookingBodySchema,
  type CreateBookingBody,
} from '../dto/create-booking-body.schema';
import {
  bookingsListResponseSchema,
  cancelBookingResponseSchema,
  createBookingRequestSchema,
  createBookingResponseSchema,
} from './bookings.openapi-schemas';

type AuthedRequest = Request & { user: AuthenticatedUser };

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Создать бронирование',
    description:
      'Запись в статусе `pending`. Требуется JWT клиента. `startsAt` — ISO 8601.',
  })
  @ApiLocaleQueryDocs()
  @ApiBody({ schema: createBookingRequestSchema })
  @ApiCreatedResponse({ schema: createBookingResponseSchema })
  @ApiBadRequestResponse({ description: 'Невалидное тело или слот в прошлом' })
  @ApiUnauthorizedResponse({ description: 'Нет access token' })
  async create(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(createBookingBodySchema))
    body: CreateBookingBody,
    @RequestLocale() locale: ApiLocale,
  ) {
    return this.bookingsService.createBooking(req.user.id, body, locale);
  }

  @Get()
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Мои бронирования',
    description:
      'Список записей текущего пользователя (клиента), новые сверху.',
  })
  @ApiOkResponse({ schema: bookingsListResponseSchema })
  @ApiUnauthorizedResponse({ description: 'Нет access token' })
  async list(@Req() req: AuthedRequest) {
    return this.bookingsService.listMine(req.user.id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Отменить бронирование (клиент)',
    description:
      'Доступно для статусов `pending`, `confirmed`, `in_progress`. Слот снова становится свободным.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ schema: cancelBookingResponseSchema })
  @ApiBadRequestResponse({
    description: 'Нельзя отменить в текущем статусе',
  })
  @ApiNotFoundResponse({ description: 'Запись не найдена' })
  @ApiUnauthorizedResponse({ description: 'Нет access token' })
  async cancel(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookingsService.cancelByClient(req.user.id, id);
  }
}
