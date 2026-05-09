import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Опциональная Postgres-копия JSON документа поиска (дифф с Typesense, отладка).
 *
 * Политика: обновлять `SearchDocumentProjection` только через этот сервис или единый
 * consumer outbox, чтобы не плодить «тихие» расхождения с индексом (см. ADR marketplace,
 * `docs/adr/public-listing-contract.md`).
 */
@Injectable()
export class SearchProjectionShadowService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertOfferingDocument(input: {
    organizationOfferingId: string;
    document: Record<string, unknown>;
    projectionBuildVersion: number;
  }): Promise<void> {
    const schemaVersionRaw = input.document.schemaVersion;
    const schemaVersion =
      typeof schemaVersionRaw === 'number' && Number.isFinite(schemaVersionRaw)
        ? schemaVersionRaw
        : 1;
    await this.prisma.searchDocumentProjection.upsert({
      where: { organizationOfferingId: input.organizationOfferingId },
      create: {
        organizationOfferingId: input.organizationOfferingId,
        schemaVersion,
        document: input.document as Prisma.InputJsonValue,
        projectionBuildVersion: input.projectionBuildVersion,
      },
      update: {
        schemaVersion,
        document: input.document as Prisma.InputJsonValue,
        projectionBuildVersion: input.projectionBuildVersion,
      },
    });
  }
}
