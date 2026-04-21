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

@Injectable()
export class BookingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findManyForClient(clientUserId: string): Promise<BookingListRow[]> {
    return this.prisma.booking.findMany({
      where: { clientUserId, deletedAt: null },
      include: bookingListInclude,
      orderBy: { startsAt: 'desc' },
    });
  }
}
