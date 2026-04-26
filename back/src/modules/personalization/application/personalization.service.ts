import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import { subDays } from 'date-fns';
import type { DirectoryListRadiusFilter } from '../../../common/pagination/directory-list-radius-filter';
import { DirectoryService } from '../../directory/application/directory.service';
import type { OrganizationsListResponseDto } from '../../directory/dto/organizations-list-response.dto';
import type { SpecialistsListResponseDto } from '../../directory/dto/specialists-list-response.dto';
import type { ApiLocale } from '../../../common/i18n';
import {
  PREFERENCE_PROFILE_JSON_VERSION,
  type PreferenceProfileV1,
} from '../domain/preference-profile.v1';
import { PersonalizationRepository } from '../infrastructure/personalization.repository';
import { MIN_PROFILE_CATEGORY_SLUGS_FOR_RECOMMENDED } from '../personalization.constants';
import type { IngestPersonalizationEventsBody } from '../dto/personalization-body.schema';

const FAVORITE_CATEGORY_WEIGHT = 3;
const BEHAVIOR_EVENT_CATEGORY_WEIGHT = 1;

export type PersonalizationRecommendationsResult = {
  source: 'profile' | 'guest_popular';
  /** Показывать ли блок: только залогиненный + достаточно сигнала в портрете (категории). */
  personalizationReady: boolean;
  majorSlug: string | null;
  categorySlugsUsed: string[];
  specialists: SpecialistsListResponseDto['specialists'];
  organizations: OrganizationsListResponseDto['organizations'];
};

/** Результат той же логики, что и для GET /personalization/recommendations (фильтры портрета/запроса). */
export type RecommendationListingResolution =
  | {
      personalizationReady: false;
      majorForList: string | null;
      categorySlugsUsed: string[];
      priceMinVnd: number | null;
      priceMaxVnd: number | null;
    }
  | {
      personalizationReady: true;
      majorForList: string | null;
      categorySlugsUsed: string[];
      priceMinVnd: number | null;
      priceMaxVnd: number | null;
    };

@Injectable()
export class PersonalizationService {
  private readonly logger = new Logger(PersonalizationService.name);

  constructor(
    @Inject(PersonalizationRepository)
    private readonly personalizationRepository: PersonalizationRepository,
    @Inject(forwardRef(() => DirectoryService))
    private readonly directoryService: DirectoryService,
    @Inject(ConfigService)
    private readonly config: ConfigService,
  ) {}

  private mapPreferenceProfileFromRow(
    row: { profile: Prisma.JsonValue } | null,
  ): PreferenceProfileV1 {
    const empty: PreferenceProfileV1 = {
      version: PREFERENCE_PROFILE_JSON_VERSION,
      categorySlugs: [],
      majorSlug: null,
      lastGeo: null,
      priceMinVnd: null,
      priceMaxVnd: null,
    };
    const fromDb = (row?.profile ?? null) as Record<string, unknown> | null;
    if (fromDb == null) {
      return empty;
    }
    const v = fromDb['version'];
    const versionOk =
      v === PREFERENCE_PROFILE_JSON_VERSION ||
      v === '1' ||
      Number(v) === PREFERENCE_PROFILE_JSON_VERSION;
    const categorySlugs = Array.isArray(fromDb['categorySlugs'])
      ? (fromDb['categorySlugs'] as unknown[]).filter(
          (s): s is string => typeof s === 'string' && s.length > 0,
        )
      : [];
    const majorRaw = fromDb['majorSlug'];
    const majorSlug: string | null =
      typeof majorRaw === 'string' || majorRaw === null
        ? typeof majorRaw === 'string'
          ? majorRaw
          : null
        : null;
    const lastGeoRaw = fromDb['lastGeo'];
    const lastGeo =
      lastGeoRaw != null &&
      typeof lastGeoRaw === 'object' &&
      !Array.isArray(lastGeoRaw) &&
      typeof (lastGeoRaw as { lat?: unknown }).lat === 'number' &&
      typeof (lastGeoRaw as { lng?: unknown }).lng === 'number'
        ? {
            lat: (lastGeoRaw as { lat: number }).lat,
            lng: (lastGeoRaw as { lng: number }).lng,
          }
        : null;
    const parseStoredVnd = (v: unknown): number | null => {
      if (v == null) {
        return null;
      }
      if (typeof v === 'number' && Number.isInteger(v) && v >= 0) {
        return v;
      }
      return null;
    };
    let priceMinVnd = parseStoredVnd(fromDb['priceMinVnd']);
    let priceMaxVnd = parseStoredVnd(fromDb['priceMaxVnd']);
    if (
      priceMinVnd != null &&
      priceMaxVnd != null &&
      priceMinVnd > priceMaxVnd
    ) {
      const t = priceMinVnd;
      priceMinVnd = priceMaxVnd;
      priceMaxVnd = t;
    }
    if (!versionOk && categorySlugs.length === 0) {
      return empty;
    }
    return {
      version: PREFERENCE_PROFILE_JSON_VERSION,
      categorySlugs,
      majorSlug,
      lastGeo,
      priceMinVnd,
      priceMaxVnd,
    };
  }

  /**
   * Удаляет `UserBehaviorEvent` старше `personalization.behaviorEventsRetentionDays` (cron).
   * `UserPreferenceProfile` не трогает.
   */
  async purgeStaleBehaviorEvents(): Promise<{ deleted: number }> {
    const days = this.config.getOrThrow<number>(
      'personalization.behaviorEventsRetentionDays',
    );
    const cutoff = subDays(new Date(), days);
    const deleted =
      await this.personalizationRepository.deleteBehaviorEventsCreatedBefore(
        cutoff,
      );
    if (deleted > 0) {
      this.logger.log(
        `Purged ${deleted} user behavior event(s) older than ${days}d (before ${cutoff.toISOString()})`,
      );
    }
    return { deleted };
  }

  async ingestEvents(input: {
    userId: string | null;
    sessionId: string | null;
    body: IngestPersonalizationEventsBody;
  }): Promise<{ accepted: number }> {
    const userId = input.userId;
    if (
      userId == null &&
      (input.body.sessionId == null || input.body.sessionId === '')
    ) {
      throw new BadRequestException({
        code: 'SESSION_OR_AUTH_REQUIRED',
        message: 'Нужен access token или sessionId',
      });
    }
    const sessionId =
      userId != null
        ? input.body.sessionId?.trim() || null
        : input.body.sessionId!.trim();

    const rows: Prisma.UserBehaviorEventCreateManyInput[] =
      input.body.events.map((e) => {
        const meta: Prisma.InputJsonValue =
          (e.metadata as Prisma.InputJsonValue | undefined) ?? {};
        return {
          userId,
          sessionId: userId == null ? sessionId : sessionId,
          eventType: e.eventType,
          entityType: e.entityType ?? null,
          entityId: e.entityId ?? null,
          metadata: meta,
        };
      });
    await this.personalizationRepository.createBehaviorEvents(rows);
    if (userId != null) {
      void this.recomputeProfileForUser(userId).catch((err) => {
        this.logger.warn(
          `recomputeProfileForUser after ingest failed: ${(err as Error).message}`,
        );
      });
    }
    return { accepted: rows.length };
  }

  /**
   * Пересчёт портрета: избранное, брони, события (подкатегории в metadata).
   */
  async recomputeProfileForUser(userId: string): Promise<PreferenceProfileV1> {
    const existingRow =
      await this.personalizationRepository.findPreferenceProfileByUserId(
        userId,
      );
    const previousProfile = this.mapPreferenceProfileFromRow(existingRow);

    const scores = new Map<string, number>();

    for (const slug of await this.personalizationRepository.getFavoriteServiceCategorySlugs(
      userId,
    )) {
      scores.set(slug, (scores.get(slug) ?? 0) + FAVORITE_CATEGORY_WEIGHT);
    }

    const bookingW =
      await this.personalizationRepository.getBookingCategorySlugWeights(
        userId,
      );
    for (const [slug, w] of bookingW) {
      scores.set(slug, (scores.get(slug) ?? 0) + w);
    }

    const eventHints =
      await this.personalizationRepository.getBehaviorEventHints(userId, 30);
    for (const h of eventHints) {
      const m = h.metadata as {
        categorySlugs?: unknown;
      };
      if (Array.isArray(m.categorySlugs)) {
        for (const s of m.categorySlugs) {
          if (typeof s === 'string' && s.length > 0 && s.length < 64) {
            scores.set(
              s,
              (scores.get(s) ?? 0) + BEHAVIOR_EVENT_CATEGORY_WEIGHT,
            );
          }
        }
      }
    }

    const orderedSlugs = [...scores.entries()]
      .filter(([, w]) => w > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([slug]) => slug)
      .slice(0, 8);

    const topSlug = orderedSlugs[0] ?? null;
    let majorSlug =
      await this.personalizationRepository.getMajorSlugByServiceCategorySlug(
        topSlug,
      );

    const lastGeo =
      await this.personalizationRepository.getLatestGeoFromBehaviorEvents(
        userId,
      );

    const priceHint =
      await this.personalizationRepository.getLatestSearchPriceFromBehaviorEvents(
        userId,
      );
    const priceMinVnd = priceHint.fromEvent
      ? priceHint.priceMinVnd
      : (previousProfile.priceMinVnd ?? null);
    const priceMaxVnd = priceHint.fromEvent
      ? priceHint.priceMaxVnd
      : (previousProfile.priceMaxVnd ?? null);

    if (orderedSlugs.length > 0 && majorSlug == null) {
      for (const s of orderedSlugs) {
        const m =
          await this.personalizationRepository.getMajorSlugByServiceCategorySlug(
            s,
          );
        if (m != null) {
          majorSlug = m;
          break;
        }
      }
    }

    const profile: PreferenceProfileV1 = {
      version: PREFERENCE_PROFILE_JSON_VERSION,
      categorySlugs: orderedSlugs,
      majorSlug: majorSlug ?? null,
      lastGeo,
      priceMinVnd,
      priceMaxVnd,
    };

    await this.personalizationRepository.upsertPreferenceProfile({
      userId,
      version: 1,
      profile,
    });
    return profile;
  }

  /**
   * Пакетный пересчёт (cron): ограниченный батч id.
   */
  async recomputeProfilesBatch(): Promise<{ processed: number }> {
    const ids =
      await this.personalizationRepository.findUserIdsForRecomputeBatch(200);
    for (const id of ids) {
      try {
        await this.recomputeProfileForUser(id);
      } catch (e) {
        this.logger.warn(
          `recomputeProfileForUser ${id} failed: ${(e as Error).message}`,
        );
      }
    }
    return { processed: ids.length };
  }

  /**
   * Общая логика с GET /personalization/recommendations: портрет, готовность, фильтры списка.
   * Нужна для `sort=recommended` в каталоге и для превью без загрузки списков (`listLimit=0`).
   */
  async resolveRecommendationListing(
    userId: string | null,
    options: {
      majorSlug: string | null;
      /** Явно заданные подкатегории (с поиска), иначе из портрета. */
      categorySlugs: string[] | null;
      radius: DirectoryListRadiusFilter | null;
      vndPriceOverride: {
        priceMinVnd: number | null;
        priceMaxVnd: number | null;
      } | null;
    },
  ): Promise<RecommendationListingResolution> {
    if (userId == null) {
      return {
        personalizationReady: false,
        majorForList: null,
        categorySlugsUsed: [],
        priceMinVnd: null,
        priceMaxVnd: null,
      };
    }

    let row =
      await this.personalizationRepository.findPreferenceProfileByUserId(
        userId,
      );
    const hadProfileRowAtStart = row != null;
    if (row == null) {
      await this.recomputeProfileForUser(userId);
      row =
        await this.personalizationRepository.findPreferenceProfileByUserId(
          userId,
        );
    }

    let profile = this.mapPreferenceProfileFromRow(row);

    if (profile.categorySlugs.length === 0 && hadProfileRowAtStart) {
      await this.recomputeProfileForUser(userId);
      row =
        await this.personalizationRepository.findPreferenceProfileByUserId(
          userId,
        );
      profile = this.mapPreferenceProfileFromRow(row);
    }

    const categorySlugs =
      options.categorySlugs && options.categorySlugs.length > 0
        ? options.categorySlugs
        : profile.categorySlugs;

    const majorForList =
      options.majorSlug !== null && options.majorSlug !== undefined
        ? options.majorSlug
        : (profile.majorSlug ?? null);

    const priceMinVnd =
      options.vndPriceOverride != null
        ? options.vndPriceOverride.priceMinVnd
        : (profile.priceMinVnd ?? null);
    const priceMaxVnd =
      options.vndPriceOverride != null
        ? options.vndPriceOverride.priceMaxVnd
        : (profile.priceMaxVnd ?? null);

    const fromProfileOrExplicitFilters =
      (options.categorySlugs != null && options.categorySlugs.length > 0) ||
      (options.majorSlug != null && options.majorSlug !== '');

    const personalizationReady =
      fromProfileOrExplicitFilters ||
      profile.categorySlugs.length >=
        MIN_PROFILE_CATEGORY_SLUGS_FOR_RECOMMENDED;

    if (!personalizationReady) {
      return {
        personalizationReady: false,
        majorForList,
        categorySlugsUsed: categorySlugs,
        priceMinVnd,
        priceMaxVnd,
      };
    }
    return {
      personalizationReady: true,
      majorForList,
      categorySlugsUsed: categorySlugs,
      priceMinVnd,
      priceMaxVnd,
    };
  }

  async getRecommendations(
    userId: string | null,
    locale: ApiLocale,
    options: {
      limitSpecialists: number;
      limitOrganizations: number;
      majorSlug: string | null;
      /** Явно заданные подкатегории (с поиска), иначе из портрета. */
      categorySlugs: string[] | null;
      radius: DirectoryListRadiusFilter | null;
      /**
       * Если задано (хотя бы один query `priceMinVnd` / `priceMaxVnd`) — как в поиске.
       * Иначе цена из портрета (последний `search_apply_filters` с ценой в metadata).
       */
      vndPriceOverride: {
        priceMinVnd: number | null;
        priceMaxVnd: number | null;
      } | null;
    },
  ): Promise<PersonalizationRecommendationsResult> {
    if (userId == null) {
      return {
        source: 'guest_popular',
        personalizationReady: false,
        majorSlug: null,
        categorySlugsUsed: [],
        specialists: [],
        organizations: [],
      };
    }

    const resolved = await this.resolveRecommendationListing(userId, {
      majorSlug: options.majorSlug,
      categorySlugs: options.categorySlugs,
      radius: options.radius,
      vndPriceOverride: options.vndPriceOverride,
    });

    if (!resolved.personalizationReady) {
      return {
        source: 'profile',
        personalizationReady: false,
        majorSlug: resolved.majorForList,
        categorySlugsUsed: resolved.categorySlugsUsed,
        specialists: [],
        organizations: [],
      };
    }

    const { majorForList, categorySlugsUsed, priceMinVnd, priceMaxVnd } =
      resolved;
    const catForApi = categorySlugsUsed.length > 0 ? categorySlugsUsed : [];

    if (options.limitSpecialists === 0 && options.limitOrganizations === 0) {
      return {
        source: 'profile',
        personalizationReady: true,
        majorSlug: majorForList,
        categorySlugsUsed,
        specialists: [],
        organizations: [],
      };
    }

    const priceFromQuery = options.vndPriceOverride != null;

    const sp = await this.directoryService.listSpecialists(locale, {
      limit: options.limitSpecialists,
      sort: 'popularity',
      cursor: null,
      majorCategorySlug: majorForList,
      q: null,
      categorySlugs: catForApi,
      priceMinVnd,
      priceMaxVnd,
      radius: options.radius,
      userId,
      priceFromQuery,
    });
    const org = await this.directoryService.listOrganizations(locale, {
      limit: options.limitOrganizations,
      sort: 'popularity',
      cursor: null,
      majorCategorySlug: majorForList,
      q: null,
      categorySlugs: catForApi,
      radius: options.radius,
      userId,
    });

    return {
      source: 'profile',
      personalizationReady: true,
      majorSlug: majorForList,
      categorySlugsUsed,
      specialists: sp.specialists,
      organizations: org.organizations,
    };
  }
}
