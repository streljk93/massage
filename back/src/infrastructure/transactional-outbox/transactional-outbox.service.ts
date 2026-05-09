import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

@Injectable()
export class TransactionalOutboxService {
  async enqueueBookingCreated(
    tx: Prisma.TransactionClient,
    bookingId: string,
  ): Promise<void> {
    await tx.transactionalOutboxEntry.create({
      data: {
        topic: 'marketplace',
        aggregateType: 'Booking',
        aggregateId: bookingId,
        eventType: 'booking.created',
        payload: { bookingId },
        dedupeKey: `booking.created:${bookingId}`,
      },
    });
  }
}
