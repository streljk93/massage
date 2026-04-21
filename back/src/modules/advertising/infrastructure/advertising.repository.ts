import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

const advertisementWithLocalesInclude = {
  locales: true,
} satisfies Prisma.AdvertisementInclude;

export type AdvertisementWithLocales = Prisma.AdvertisementGetPayload<{
  include: typeof advertisementWithLocalesInclude;
}>;

@Injectable()
export class AdvertisingRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveByPlacement(placement: string): Promise<AdvertisementWithLocales[]> {
    return this.prisma.advertisement.findMany({
      where: {
        placement,
        isActive: true,
        deletedAt: null,
      },
      orderBy: { sortOrder: 'asc' },
      include: advertisementWithLocalesInclude,
    });
  }
}
