import { Injectable } from '@nestjs/common';
import type { FavoriteTargetKind } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

export type FavoriteRow = {
  targetKind: FavoriteTargetKind;
  targetId: string;
  createdAt: Date;
};

@Injectable()
export class FavoritesRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByUserId(userId: string): Promise<FavoriteRow[]> {
    return this.prisma.userFavorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: {
        targetKind: true,
        targetId: true,
        createdAt: true,
      },
    });
  }

  async findActiveOrganizationIds(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) {
      return new Set();
    }
    const rows = await this.prisma.organization.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true },
    });
    return new Set(rows.map((r) => r.id));
  }

  async findActiveSpecialistIds(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) {
      return new Set();
    }
    const rows = await this.prisma.specialist.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
        listedInDirectory: true,
        activeOrganizationId: { not: null },
      },
      select: { id: true },
    });
    return new Set(rows.map((r) => r.id));
  }

  async createManyIgnoreDuplicates(
    userId: string,
    items: { targetKind: FavoriteTargetKind; targetId: string }[],
  ): Promise<void> {
    if (items.length === 0) {
      return;
    }
    await this.prisma.userFavorite.createMany({
      data: items.map((i) => ({
        userId,
        targetKind: i.targetKind,
        targetId: i.targetId,
      })),
      skipDuplicates: true,
    });
  }

  async createIgnoreDuplicate(
    userId: string,
    targetKind: FavoriteTargetKind,
    targetId: string,
  ): Promise<void> {
    await this.prisma.userFavorite.createMany({
      data: [{ userId, targetKind, targetId }],
      skipDuplicates: true,
    });
  }

  async deleteOne(
    userId: string,
    targetKind: FavoriteTargetKind,
    targetId: string,
  ): Promise<void> {
    await this.prisma.userFavorite.deleteMany({
      where: { userId, targetKind, targetId },
    });
  }
}
