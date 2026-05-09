import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TransactionalOutboxStatus } from '@prisma/client';
import { MarketplaceListingEdgesIndexService } from '../../modules/directory/application/marketplace-listing-edges-index.service';
import { PrismaService } from '../prisma/prisma.service';

/** Черновой воркер outbox (§3.0.9): dispatch → последующая проекция/индекс в отдельных consumers. */
@Injectable()
export class TransactionalOutboxCronService {
  private readonly log = new Logger(TransactionalOutboxCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly listingEdgesIndex: MarketplaceListingEdgesIndexService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async processPendingChunk(): Promise<void> {
    const batch = await this.prisma.transactionalOutboxEntry.findMany({
      where: { status: TransactionalOutboxStatus.pending },
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: { id: true, eventType: true, aggregateType: true, aggregateId: true },
    });
    if (batch.length === 0) {
      return;
    }
    const now = new Date();
    for (const row of batch) {
      this.log.debug(
        `Outbox dispatch: ${row.eventType} ${row.aggregateType}:${row.aggregateId}`,
      );
      try {
        if (
          row.eventType === 'booking.created' &&
          row.aggregateType === 'Booking'
        ) {
          const booking = await this.prisma.booking.findUnique({
            where: { id: row.aggregateId },
            select: { specialistId: true },
          });
          if (
            booking?.specialistId != null &&
            booking.specialistId.trim() !== ''
          ) {
            await this.listingEdgesIndex.upsertAllEdgesForSpecialist(
              booking.specialistId,
            );
          }
        }
      } catch (e) {
        this.log.warn(
          `Outbox side-effect ${row.id} ${row.eventType}: ${String(e)}`,
        );
      }
      await this.prisma.transactionalOutboxEntry.update({
        where: { id: row.id },
        data: {
          status: TransactionalOutboxStatus.dispatched,
          dispatchedAt: now,
          lastError: null,
        },
      });
    }
  }
}
