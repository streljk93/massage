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
  ApiQuery,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import {
  ApiLocaleQueryDocs,
  OptionalRequestLocale,
  RequestLocale,
  type ApiLocale,
} from '../../../common/i18n';
import { JwtAccessGuard, type AuthenticatedUser } from '../../../common/guards';
import { BookingsService } from '../application/bookings.service';
import { BOOKING_STATUS_ALL_ORDERED } from '../domain/booking-status-all-ordered';
import {
  bookingsListQuerySchema,
  type BookingsListQuery,
} from '../dto/bookings-list-query.schema';
import {
  cancelBookingBodySchema,
  type CancelBookingBody,
} from '../dto/cancel-booking-body.schema';
import {
  createBookingBodySchema,
  type CreateBookingBody,
} from '../dto/create-booking-body.schema';
import {
  bookingsListResponseSchema,
  cancelBookingRequestSchema,
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
      'Создаёт бронь: обычно `pending` (ожидание мастера) с `pendingExpiresAt`, либо сразу `confirmed`, если у мастера включено авто‑подтверждение. Требуется JWT клиента. `startsAt` — ISO 8601.',
  })
  @ApiLocaleQueryDocs()
  @ApiBody({ schema: createBookingRequestSchema })
  @ApiCreatedResponse({ schema: createBookingResponseSchema })
  @ApiBadRequestResponse({ description: 'Невалидное тело или слот в прошлом' })
  @ApiTooManyRequestsResponse({
    description:
      'Лимит создания броней для клиента (pending / час / сутки). См. тело: code BOOKING_CLIENT_*',
  })
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
      'Список записей клиента: сверху недавно обновлённые (в т.ч. после авто-expired), затем по времени приёма. `statusLabel` — из query `locale` или `User.locale`. Опционально фильтр по статусам: повтор `?status=confirmed&status=in_progress` или скобочная форма `?status[]=confirmed&status[]=in_progress` (в Express она приходит как ключ `status[]`).',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    isArray: true,
    enum: BOOKING_STATUS_ALL_ORDERED,
    description:
      'Фильтр по кодам статуса в БД (несколько раз или `status[]=`). Клиенты со скобками — поддерживаются. Без параметра — все записи клиента.',
  })
  @ApiLocaleQueryDocs()
  @ApiOkResponse({ schema: bookingsListResponseSchema })
  @ApiBadRequestResponse({
    description: 'Невалидный query (в т.ч. неизвестный status)',
  })
  @ApiUnauthorizedResponse({ description: 'Нет access token' })
  async list(
    @Req() req: AuthedRequest,
    @OptionalRequestLocale() locale: ApiLocale | undefined,
  ) {
    /**
     * Не вешаем Zod на `@Query(pipe)`: в Nest значение в pipe для query может
     * приходить не как полный `req.query`, из‑за чего теряются повторяющиеся
     * `status` и фильтр в БД не применяется.
     */
    const query = new ZodValidationPipe(bookingsListQuerySchema).transform(
      req.query,
    ) as BookingsListQuery;
    return this.bookingsService.listMine(req.user.id, locale, query.status);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Отменить бронирование (клиент)',
    description:
      'Доступно для `pending`, `confirmed`, `in_progress`. Для `pending` тело можно опустить или передать `{}` — причина не сохраняется, статус `reject_by_client`. Для `confirmed` / `in_progress` обязателен `cancelReason`; при `client_other` — непустой `cancellationComment`; статус `canceled_by_client`. Слот снова свободен.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ schema: cancelBookingRequestSchema })
  @ApiOkResponse({ schema: cancelBookingResponseSchema })
  @ApiBadRequestResponse({
    description: 'Нельзя отменить в текущем статусе или невалидное тело',
  })
  @ApiNotFoundResponse({ description: 'Запись не найдена' })
  @ApiUnauthorizedResponse({ description: 'Нет access token' })
  async cancel(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(cancelBookingBodySchema))
    body: CancelBookingBody,
  ) {
    return this.bookingsService.cancelByClient(req.user.id, id, body);
  }
}
