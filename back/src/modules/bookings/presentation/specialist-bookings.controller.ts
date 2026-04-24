import {
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
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAccessGuard, type AuthenticatedUser } from '../../../common/guards';
import { BookingsService } from '../application/bookings.service';
import { specialistConfirmBookingResponseSchema } from './bookings.openapi-schemas';

type AuthedRequest = Request & { user: AuthenticatedUser };

@ApiTags('bookings', 'specialist')
@Controller('specialist/bookings')
export class SpecialistBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Подтвердить запись (специалист)',
    description:
      'Переводит `pending` → `confirmed` для брони этого мастера, пишет историю, отправляет push клиенту. JWT — пользователь с профилем `Specialist`.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ schema: specialistConfirmBookingResponseSchema })
  @ApiBadRequestResponse({
    description: 'Статус не `pending` (код `BOOKING_NOT_PENDING`)',
  })
  @ApiForbiddenResponse({ description: 'У JWT нет профиля специалиста' })
  @ApiNotFoundResponse({ description: 'Бронь не найдена или чужая' })
  @ApiUnauthorizedResponse({ description: 'Нет access token' })
  async confirmPending(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookingsService.confirmPendingBySpecialist(req.user.id, id);
  }
}
