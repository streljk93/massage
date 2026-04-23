import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
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
      'Иначе ответ 404. Достаточно `bookingId` + `status`; переходы не валидируются. ' +
      'В истории `actorUserId` = null (как системная правка). ' +
      'Все коды `status` — в схеме тела (enum); **Examples** — по одному на статус.',
  })
  @ApiBody({
    type: SetTestBookingStatusSwaggerDto,
    examples: devBookingsSetStatusSwaggerExamples,
  })
  @ApiOkResponse({ type: SetTestBookingStatusResponseSwaggerDto })
  @ApiNotFoundResponse({
    description: 'Ручка выключена или бронь с таким id не найдена',
  })
  async setStatus(
    @Body(new ZodValidationPipe(setTestBookingStatusBodySchema))
    body: SetTestBookingStatusBody,
  ) {
    return this.devBookingStatus.setBookingStatusForDev(body);
  }
}
