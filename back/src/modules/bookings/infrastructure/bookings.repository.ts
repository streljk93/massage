import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

const bookingListInclude = {
  specialist: {
    include: {
      user: { select: { name: true } },
    },
  },
} satisfies Prisma.BookingInclude;

export type BookingListRow = Prisma.BookingGetPayload<{
  include: typeof bookingListInclude;
}>;

const ACTIVE_BOOKING_STATUSES: Array<'pending' | 'confirmed' | 'in_progress'> =
  ['pending', 'confirmed', 'in_progress'];

@Injectable()
export class BookingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Есть ли активная бронь, пересекающаяся с [startsAt, endsAt).
   */
  findActiveOverlap(
    specialistId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<{ id: string } | null> {
    return this.prisma.booking.findFirst({
      where: {
        specialistId,
        deletedAt: null,
        status: { in: ACTIVE_BOOKING_STATUSES },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { id: true },
    });
  }

  findManyForClient(clientUserId: string): Promise<BookingListRow[]> {
    return this.prisma.booking.findMany({
      where: { clientUserId, deletedAt: null },
      include: bookingListInclude,
      orderBy: { startsAt: 'desc' },
    });
  }
}
