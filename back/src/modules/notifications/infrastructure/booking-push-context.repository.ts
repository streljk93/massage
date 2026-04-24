import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type {
  BookingPushContext,
  ClientBookingReminderContext,
  BookingPushContextReader,
} from './booking-push-context.types';

export type {
  BookingPushContext,
  ClientBookingReminderContext,
  BookingPushContextReader,
};

@Injectable()
export class BookingPushContextRepository implements BookingPushContextReader {
  constructor(private readonly prisma: PrismaService) {}

  async findByBookingId(bookingId: string): Promise<BookingPushContext | null> {
    const row = await this.prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      select: {
        serviceNameSnapshot: true,
        client: { select: { name: true } },
        specialist: { select: { userId: true } },
      },
    });
    if (!row) {
      return null;
    }
    return {
      serviceNameSnapshot: row.serviceNameSnapshot,
      clientName: row.client.name,
      specialistUserId: row.specialist.userId,
    };
  }

  async findForClientReminder(
    bookingId: string,
  ): Promise<ClientBookingReminderContext | null> {
    const row = await this.prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      select: {
        serviceNameSnapshot: true,
        startsAt: true,
        client: { select: { id: true, locale: true } },
        specialist: { select: { user: { select: { name: true } } } },
      },
    });
    if (!row) {
      return null;
    }
    return {
      clientUserId: row.client.id,
      serviceName: row.serviceNameSnapshot?.trim() || 'Service',
      specialistName: row.specialist.user.name,
      startsAt: row.startsAt,
      clientLocale: row.client.locale,
    };
  }
}
