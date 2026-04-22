import { Injectable } from '@nestjs/common';
import type { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class BookingStatusLocaleRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<
    { status: BookingStatus; locale: string; label: string }[]
  > {
    return this.prisma.bookingStatusLocale.findMany({
      select: { status: true, locale: true, label: true },
    });
  }
}
