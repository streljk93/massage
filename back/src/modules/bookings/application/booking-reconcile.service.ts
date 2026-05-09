import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { BookingTxLocks } from '../domain/booking-tx-locks';
import { loadBookingTimelineOrdered } from '../domain/booking-journal';
import { commitProjectedBookingRow } from '../domain/booking-projection-commit';
import { projectBookingRowFromTimeline } from '../domain/booking-projection';

/**
 * Мягкое выравнивание: полный lenient replay журнала ORDER BY local_sequence → строка Booking (+ CAS version).
 * Для cron/админки при рассинхроне; в обычном потоке не вызывается.
 */
@Injectable()
export class BookingReconcileService {
  constructor(private readonly prisma: PrismaService) {}

  async softRebuildBookingProjectionFromJournal(bookingId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await BookingTxLocks.acquireAggregateAppend(tx, bookingId);

      const booking = await tx.booking.findFirst({
        where: { id: bookingId, deletedAt: null },
        select: { id: true, version: true },
      });
      if (booking == null) {
        throw new NotFoundException({
          code: 'BOOKING_NOT_FOUND',
          message: 'Booking not found',
        });
      }

      const timeline = await loadBookingTimelineOrdered(tx, bookingId);
      if (timeline.length < 1) {
        throw new ConflictException({
          code: 'BOOKING_RECONCILE_EMPTY_JOURNAL',
          message: 'Cannot reconcile booking without events',
        });
      }

      const tail = await tx.bookingEvent.findFirst({
        where: { bookingId },
        orderBy: [{ localSequence: 'desc' }, { id: 'desc' }],
        select: { id: true, localSequence: true },
      });
      if (tail == null) {
        throw new ConflictException({
          code: 'BOOKING_RECONCILE_NO_TAIL',
          message: 'Journal tail not found',
        });
      }

      const projection = projectBookingRowFromTimeline(timeline);
      const updated = await commitProjectedBookingRow(tx, {
        bookingId,
        expectedVersion: booking.version,
        projection,
        lastEventId: tail.id,
        lastLocalSequence: tail.localSequence,
      });
      if (updated.count !== 1) {
        throw new ConflictException({
          code: 'BOOKING_RECONCILE_VERSION_CONFLICT',
          message: 'Concurrent update; retry reconcile',
        });
      }
    });
  }
}
