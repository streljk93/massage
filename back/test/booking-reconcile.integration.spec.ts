/**
 * PostgreSQL + Prisma: задайте `DATABASE_URL` или `BOOKING_INTEGRATION_DATABASE_URL`.
 * В БД нужна хотя бы одна бронь с `BookingEvent` (например после `npm run prisma:seed` в `back/`)
 * либо укажите `BOOKING_INTEGRATION_BOOKING_ID` (uuid с непустым журналом).
 *
 * Запуск: `npm run test:integration` (по умолчанию suite пропускается без URL).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import type { BookingStatus } from '@prisma/client';
import configuration from '../src/config/configuration';
import { PrismaModule } from '../src/infrastructure/prisma/prisma.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { BookingReconcileService } from '../src/modules/bookings/application/booking-reconcile.service';
import { loadBookingTimelineOrdered } from '../src/modules/bookings/domain/booking-journal';
import { projectBookingRowFromTimeline } from '../src/modules/bookings/domain/booking-projection';

const integrationDbUrlRaw =
  process.env.BOOKING_INTEGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
const integrationDbUrl =
  typeof integrationDbUrlRaw === 'string' ? integrationDbUrlRaw.trim() : '';

const describeIntegration =
  integrationDbUrl.length > 0 ? describe : describe.skip;

describeIntegration('BookingReconcileService (integration)', () => {
  let moduleRef: TestingModule;
  let reconcile: BookingReconcileService;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.DATABASE_URL = integrationDbUrl;
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
          envFilePath: ['.env', '.env.local'],
        }),
        PrismaModule,
      ],
      providers: [BookingReconcileService],
    }).compile();

    reconcile = moduleRef.get(BookingReconcileService);
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('восстанавливает проекцию после намеренной порчи status в строке Booking', async () => {
    const explicitId = process.env.BOOKING_INTEGRATION_BOOKING_ID?.trim();
    const row =
      explicitId != null && explicitId.length > 0
        ? await prisma.booking.findFirst({
            where: {
              id: explicitId,
              deletedAt: null,
              events: { some: {} },
            },
            select: { id: true },
          })
        : await prisma.booking.findFirst({
            where: { deletedAt: null, events: { some: {} } },
            orderBy: { updatedAt: 'desc' },
            select: { id: true },
          });

    if (row == null) {
      throw new Error(
        'Нет брони с событиями: выполните `npm run prisma:seed` в `back` или задайте BOOKING_INTEGRATION_BOOKING_ID.',
      );
    }

    const bookingId = row.id;
    const timeline = await loadBookingTimelineOrdered(prisma, bookingId);
    const expected = projectBookingRowFromTimeline(timeline);

    const wrongStatus: BookingStatus =
      expected.status === 'pending' ? 'confirmed' : 'pending';

    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: wrongStatus },
    });

    await reconcile.softRebuildBookingProjectionFromJournal(bookingId);

    const after = await prisma.booking.findFirstOrThrow({
      where: { id: bookingId },
      select: { status: true },
    });

    expect(after.status).toBe(expected.status);
  });
});
