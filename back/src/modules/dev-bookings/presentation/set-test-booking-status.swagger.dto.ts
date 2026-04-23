import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DEV_BOOKING_STATUS_ENUM_VALUES } from '../dto/dev-booking-status.constants';

const bookingStatusForApi = [...DEV_BOOKING_STATUS_ENUM_VALUES] as string[];

export class SetTestBookingStatusSwaggerDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    description: 'Идентификатор брони (`Booking.id`)',
    example: '22222222-2222-4222-8222-222222222222',
  })
  bookingId!: string;

  @ApiProperty({
    type: String,
    description: 'Новый статус брони (доменный `BookingStatus`)',
    enum: bookingStatusForApi,
    enumName: 'DevBookingStatusValue',
    example: 'confirmed',
  })
  status!: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Текст в `BookingStatusHistory.reason`',
    example: 'dev: проверка UI',
  })
  reason?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Для отменоподобных статусов — `Booking.cancelReason`',
    example: 'specialist_unavailable',
  })
  cancelReason?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Для отмен — `Booking.cancellationComment`',
  })
  cancellationComment?: string;
}

export class SetTestBookingStatusResponseSwaggerDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({
    type: String,
    description: 'Статус после смены',
    example: 'confirmed',
  })
  status!: string;

  @ApiProperty({
    type: String,
    description: 'Статус до смены',
    example: 'pending',
  })
  previousStatus!: string;
}
