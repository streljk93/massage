import {
  Body,
  Controller,
  Get,
  Headers,
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
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
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
  submitBookingVisitReviewsBodySchema,
  type SubmitBookingVisitReviewsBody,
} from '../dto/submit-booking-visit-reviews-body.schema';
import {
  bookingsListResponseSchema,
  cancelBookingRequestSchema,
  cancelBookingResponseSchema,
  createBookingRequestSchema,
  createBookingResponseSchema,
  submitBookingVisitReviewsRequestSchema,
  submitBookingVisitReviewsResponseSchema,
} from './bookings.openapi-schemas';

type AuthedRequest = Request & { user: AuthenticatedUser };

@ApiTags('bookings')
@ApiHeader({
  name: 'Idempotency-Key',
  required: false,
  description:
    'Идемпотентность создания брони и обязательный повтор той же строки при ответе 503 `BOOKING_BUSY_RETRY` или после 202 `BOOKING_QUEUED` (очередь команд при `BOOKING_COMMAND_QUEUE_ENABLED=true`)',
})
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
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description:
      'Запрос принят в очередь (`BOOKING_QUEUED`) при перегрузке lock; повторите POST с тем же Idempotency-Key через несколько секунд. Включено при `BOOKING_COMMAND_QUEUE_ENABLED=true` и Redis.',
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description:
      'Перегрузка блокировки слота (BOOKING_BUSY_RETRY). Повторите с тем же Idempotency-Key',
  })
  @ApiTooManyRequestsResponse({
    description:
      'Лимит создания броней для клиента (pending / час / сутки). См. тело: code BOOKING_CLIENT_*',
  })
  @ApiUnauthorizedResponse({ description: 'Нет access token' })
  async create(
    @Req() req: AuthedRequest,
    @Headers('idempotency-key') idempotencyKeyRaw: string | undefined,
    @Body(new ZodValidationPipe(createBookingBodySchema))
    body: CreateBookingBody,
    @RequestLocale() locale: ApiLocale,
  ) {
    return this.bookingsService.createBooking(
      req.user.id,
      body,
      locale,
      idempotencyKeyRaw,
    );
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

  @Post(':id/visit-reviews')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Оценить визит (салон + мастер)',
    description:
      'Создаёт **два** отзыва: `OrganizationReview` и `SpecialistReview` с привязкой к `bookingId`. Только `status === done`, один раз. Контекст салона для отзыва берётся из `organizationId` брони.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ schema: submitBookingVisitReviewsRequestSchema })
  @ApiOkResponse({ schema: submitBookingVisitReviewsResponseSchema })
  @ApiBadRequestResponse({
    description: 'Неверные оценки, не `done` или нельзя определить организацию',
  })
  @ApiConflictResponse({
    description: 'По визиту отзыв уже оставлен',
  })
  @ApiNotFoundResponse({ description: 'Запись не найдена' })
  @ApiUnauthorizedResponse({ description: 'Нет access token' })
  async submitVisitReviews(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(submitBookingVisitReviewsBodySchema))
    body: SubmitBookingVisitReviewsBody,
  ) {
    return this.bookingsService.submitVisitReviews(req.user.id, id, body);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Отменить бронирование (клиент)',
    description:
      'Доступно для `pending` и `confirmed` (матрица допустимых переходов — `booking-status-transitions`). Для `pending` тело можно опустить или передать `{}` — причина не сохраняется, статус `reject_by_client`. Для `confirmed` обязателен `cancelReason`; при `client_other` — непустой `cancellationComment`; статус `canceled_by_client`. В статусе `in_progress` клиентская отмена не предусмотрена — только завершение приёма (`done`) на стороне мастера/системы. Слот снова свободен.',
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
