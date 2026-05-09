import { Injectable } from '@nestjs/common';
import { Prisma, type Prisma as PrismaType } from '@prisma/client';
import { subDays } from 'date-fns';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { queryOrganizationStorefrontCategoryPairs } from '../../directory/infrastructure/organization-vitrine-category-coverage';
@Injectable()
export class PersonalizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createBehaviorEvents(
    rows: PrismaType.UserBehaviorEventCreateManyInput[],
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    await this.prisma.userBehaviorEvent.createMany({ data: rows });
  }

  findPreferenceProfileByUserId(userId: string): Promise<{
    userId: string;
    version: number;
    profile: Prisma.JsonValue;
    computedAt: Date;
  } | null> {
    return this.prisma.userPreferenceProfile.findUnique({
      where: { userId },
    });
  }

  async upsertPreferenceProfile(args: {
    userId: string;
    version: number;
    profile: Prisma.InputJsonValue;
  }): Promise<void> {
    await this.prisma.userPreferenceProfile.upsert({
      where: { userId: args.userId },
      create: {
        userId: args.userId,
        version: args.version,
        profile: args.profile,
        computedAt: new Date(),
      },
      update: {
        version: args.version,
        profile: args.profile,
        computedAt: new Date(),
      },
    });
  }

  /**
   * Кандидаты на пересчёт: есть избранное, брони или недавние события.
   */
  async findUserIdsForRecomputeBatch(limit: number): Promise<string[]> {
    const since = subDays(new Date(), 90);
    const rows = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        OR: [
          { favorites: { some: {} } },
          { clientBookings: { some: { deletedAt: null } } },
          { behaviorEvents: { some: { createdAt: { gte: since } } } },
        ],
      },
      select: { id: true },
      take: limit,
      orderBy: { id: 'asc' },
    });
    return rows.map((r) => r.id);
  }

  async getFavoriteServiceCategorySlugs(
    userId: string,
  ): Promise<readonly string[]> {
    const favs = await this.prisma.userFavorite.findMany({
      where: { userId },
    });
    if (favs.length === 0) {
      return [];
    }
    const specIds = favs
      .filter((f) => f.targetKind === 'specialist')
      .map((f) => f.targetId);
    const orgIds = favs
      .filter((f) => f.targetKind === 'organization')
      .map((f) => f.targetId);
    const [fromSpec, fromOrg, storefrontOrgCategories] = await Promise.all([
      specIds.length > 0
        ? this.prisma.specialistSkill.findMany({
            where: { specialistId: { in: specIds } },
            include: { serviceCategory: { select: { slug: true } } },
          })
        : Promise.resolve([]),
      orgIds.length > 0
        ? this.prisma.organizationServiceCategory.findMany({
            where: { organizationId: { in: orgIds } },
            include: { serviceCategory: { select: { slug: true } } },
          })
        : Promise.resolve([]),
      orgIds.length > 0
        ? queryOrganizationStorefrontCategoryPairs(this.prisma, orgIds)
        : Promise.resolve(new Map<string, Set<string>>()),
    ]);
    const set = new Set<string>();
    for (const r of fromSpec) {
      set.add(r.serviceCategory.slug);
    }
    for (const r of fromOrg) {
      const visible = storefrontOrgCategories.get(r.organizationId);
      if (visible?.has(r.serviceCategoryId)) {
        set.add(r.serviceCategory.slug);
      }
    }
    return [...set];
  }

  /**
   * Недавние брони: веса по slug подкатегории из якоря оффера (`OrganizationOffering` → category).
   */
  async getBookingCategorySlugWeights(
    userId: string,
  ): Promise<ReadonlyMap<string, number>> {
    const since = subDays(new Date(), 90);
    const bookings = await this.prisma.booking.findMany({
      where: {
        clientUserId: userId,
        deletedAt: null,
        createdAt: { gte: since },
      },
      include: {
        organizationOffering: {
          include: { category: { select: { slug: true } } },
        },
      },
      take: 80,
      orderBy: { createdAt: 'desc' },
    });
    const map = new Map<string, number>();
    for (const b of bookings) {
      if (b.organizationOffering == null) {
        continue;
      }
      const slug = b.organizationOffering.category.slug;
      const w = b.status === 'done' ? 2 : 1;
      map.set(slug, (map.get(slug) ?? 0) + w);
    }
    return map;
  }

  /**
   * События витрины за окно: подкатегории из `metadata` и гео.
   */
  async getBehaviorEventHints(userId: string, days: number) {
    const since = subDays(new Date(), days);
    return this.prisma.userBehaviorEvent.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { eventType: true, metadata: true },
    });
  }

  async getMajorSlugByServiceCategorySlug(
    slug: string | null,
  ): Promise<string | null> {
    if (slug == null) {
      return null;
    }
    const row = await this.prisma.serviceCategory.findFirst({
      where: { slug, deletedAt: null },
      include: {
        majorServiceCategory: { select: { slug: true, deletedAt: true } },
      },
    });
    if (
      row == null ||
      row.majorServiceCategory == null ||
      row.majorServiceCategory.deletedAt != null
    ) {
      return null;
    }
    return row.majorServiceCategory.slug;
  }

  /**
   * Последняя валидная гео-точка из `metadata` событий (WGS-84).
   */
  async getLatestGeoFromBehaviorEvents(
    userId: string,
  ): Promise<{ lat: number; lng: number } | null> {
    const rows = await this.prisma.userBehaviorEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: { metadata: true },
    });
    for (const r of rows) {
      const m = r.metadata as {
        lat?: unknown;
        lng?: unknown;
      };
      if (
        typeof m.lat === 'number' &&
        typeof m.lng === 'number' &&
        Number.isFinite(m.lat) &&
        Number.isFinite(m.lng) &&
        m.lat >= -90 &&
        m.lat <= 90 &&
        m.lng >= -180 &&
        m.lng <= 180
      ) {
        return { lat: m.lat, lng: m.lng };
      }
    }
    return null;
  }

  /**
   * Последний `search_apply_filters` с полями `priceMinVnd` / `priceMaxVnd` в `metadata` (клиент с новой версией).
   * Если `fromEvent: false` — в событиях нет цен: при пересчёте портрета **сохраняйте** цену из прежнего `profile`.
   */
  async getLatestSearchPriceFromBehaviorEvents(userId: string): Promise<
    | { fromEvent: false }
    | {
        fromEvent: true;
        priceMinVnd: number | null;
        priceMaxVnd: number | null;
      }
  > {
    const row = await this.prisma.userBehaviorEvent.findFirst({
      where: { userId, eventType: 'search_apply_filters' },
      orderBy: { createdAt: 'desc' },
      select: { metadata: true },
    });
    if (row == null) {
      return { fromEvent: false };
    }
    const m = row.metadata as Record<string, unknown>;
    if (!('priceMinVnd' in m) && !('priceMaxVnd' in m)) {
      return { fromEvent: false };
    }
    const toInt = (v: unknown): number | null => {
      if (v == null) {
        return null;
      }
      if (typeof v === 'number' && Number.isInteger(v) && v >= 0) {
        return v;
      }
      return null;
    };
    let min = toInt(m['priceMinVnd']);
    let max = toInt(m['priceMaxVnd']);
    if (min != null && max != null && min > max) {
      const t = min;
      min = max;
      max = t;
    }
    return { fromEvent: true, priceMinVnd: min, priceMaxVnd: max };
  }

  /**
   * Сырые события витрины строго старше `cutoff` (по `createdAt`).
   */
  async deleteBehaviorEventsCreatedBefore(cutoff: Date): Promise<number> {
    const { count } = await this.prisma.userBehaviorEvent.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return count;
  }
}
