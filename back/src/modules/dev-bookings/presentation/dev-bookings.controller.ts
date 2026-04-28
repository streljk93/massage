import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { DevTestRoutesGuard } from '../guards/dev-test-routes.guard';
import { DevBookingStatusService } from '../application/dev-booking-status.service';
import {
  setTestBookingStatusBodySchema,
  type SetTestBookingStatusBody,
} from '../dto/set-test-booking-status-body.schema';
import { devBookingsSetStatusSwaggerExamples } from './dev-bookings-set-status.swagger-examples';
import {
  SetTestBookingStatusResponseSwaggerDto,
  SetTestBookingStatusSwaggerDto,
} from './set-test-booking-status.swagger.dto';

@ApiTags('dev')
@Controller('dev/bookings')
@UseGuards(DevTestRoutesGuard)
export class DevBookingsController {
  constructor(private readonly devBookingStatus: DevBookingStatusService) {}

  @Post('set-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Dev] Принудительно сменить статус брони по booking id',
    description:
      'Только при `NODE_ENV !== production` и без `DISABLE_DEV_TEST_ROUTES=true`. ' +
      'Иначе ответ 404. Достаточно `bookingId` + `status`. ' +
      '**Переходы валидируются** так же, как в проде (модуль `booking-status-transitions`); недопустимый переход — `400` с `BOOKING_INVALID_STATUS_TRANSITION`. ' +
      'Для цели `in_progress` дополнительно: не раньше `startsAt` брони (с тем же допуском по времени, что при `POST /bookings/me/:id/start-visit`) — иначе `BOOKING_TOO_EARLY_FOR_IN_PROGRESS`. ' +
      'Для перехода из `confirmed` в `no_show_by_client` / `no_show_by_master` — то же условие по `startsAt`; иначе `BOOKING_TOO_EARLY_FOR_NO_SHOW`. ' +
      'В истории `actorUserId` = null (как системная правка). ' +
      'Все коды `status` — в схеме тела (enum); **Examples** — целевые статусы (сработают только если текущий статус брони допускает такой переход).',
  })
  @ApiBody({
    type: SetTestBookingStatusSwaggerDto,
    examples: devBookingsSetStatusSwaggerExamples,
  })
  @ApiOkResponse({ type: SetTestBookingStatusResponseSwaggerDto })
  @ApiNotFoundResponse({
    description: 'Ручка выключена или бронь с таким id не найдена',
  })
  @ApiBadRequestResponse({
    description:
      'Переход не разрешён (`BOOKING_INVALID_STATUS_TRANSITION`), слишком рано для `in_progress` / no-show (`BOOKING_TOO_EARLY_FOR_IN_PROGRESS`, `BOOKING_TOO_EARLY_FOR_NO_SHOW`), или невалидное тело',
  })
  async setStatus(
    @Body(new ZodValidationPipe(setTestBookingStatusBodySchema))
    body: SetTestBookingStatusBody,
  ) {
    return this.devBookingStatus.setBookingStatusForDev(body);
  }
}
