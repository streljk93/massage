import { Injectable, NotFoundException } from '@nestjs/common';
import { parseApiLocale, type ApiLocale } from '../../../common/i18n';
import { DirectoryService } from '../../directory/application/directory.service';
import { PersonalizationService } from '../../personalization/application/personalization.service';
import { PersonalizationRepository } from '../../personalization/infrastructure/personalization.repository';
import { MIN_PROFILE_CATEGORY_SLUGS_FOR_RECOMMENDED } from '../../personalization/personalization.constants';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { DevRecomputePreferenceProfileBody } from '../dto/dev-recompute-preference-profile-body.schema';

/** Как `HomeForYouSection` (`client/src/views/home/ui/home-for-you-section.tsx`). */
const HOME_FOR_YOU_LIST_LIMIT = 3;

function behaviorCategoryWeightsFromHints(
  hints: Awaited<
    ReturnType<PersonalizationRepository['getBehaviorEventHints']>
  >,
): { slug: string; weight: number }[] {
  const map = new Map<string, number>();
  for (const h of hints) {
    const m = h.metadata as { categorySlugs?: unknown };
    if (Array.isArray(m.categorySlugs)) {
      for (const s of m.categorySlugs) {
        if (typeof s === 'string' && s.length > 0 && s.length < 64) {
          map.set(s, (map.get(s) ?? 0) + 1);
        }
      }
    }
  }
  return [...map.entries()]
    .map(([slug, weight]) => ({ slug, weight }))
    .sort((a, b) => b.weight - a.weight);
}

@Injectable()
export class DevPersonalizationRecomputeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly personalization: PersonalizationService,
    private readonly personalizationRepository: PersonalizationRepository,
    private readonly directoryService: DirectoryService,
  ) {}

  async recomputeProfileForUserByEmail(
    body: DevRecomputePreferenceProfileBody,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { email: body.email, deletedAt: null },
      select: { id: true, email: true },
    });
    if (user == null) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: `Пользователь с email ${body.email} не найден`,
      });
    }
    const userId = user.id;
    const profile =
      await this.personalization.recomputeProfileForUser(userId);

    const [
      fromFavorites,
      bookingWeightsMap,
      behaviorHints,
    ] = await Promise.all([
      this.personalizationRepository.getFavoriteServiceCategorySlugs(userId),
      this.personalizationRepository.getBookingCategorySlugWeights(userId),
      this.personalizationRepository.getBehaviorEventHints(userId, 30),
    ]);

    const fromBookings = [...bookingWeightsMap.entries()]
      .map(([slug, weight]) => ({ slug, totalWeight: weight }))
      .sort((a, b) => b.totalWeight - a.totalWeight);
    const fromBehaviorEvents = behaviorCategoryWeightsFromHints(behaviorHints);

    const categorySlugsForReadyCheck = profile.categorySlugs;
    const personalizationReady =
      categorySlugsForReadyCheck.length >=
      MIN_PROFILE_CATEGORY_SLUGS_FOR_RECOMMENDED;

    const locale: ApiLocale = parseApiLocale(body.locale);
    let catalogSpecialistsCount = 0;
    let catalogOrganizationsCount = 0;
    if (personalizationReady) {
      const [sp, org] = await Promise.all([
        this.directoryService.listSpecialists(locale, {
          limit: HOME_FOR_YOU_LIST_LIMIT,
          sort: 'popularity',
          cursor: null,
          majorCategorySlug: profile.majorSlug,
          q: null,
          categorySlugs: categorySlugsForReadyCheck,
          priceMinVnd: profile.priceMinVnd ?? null,
          priceMaxVnd: profile.priceMaxVnd ?? null,
          radius: null,
          userId: null,
          priceFromQuery: false,
        }),
        this.directoryService.listOrganizations(locale, {
          limit: HOME_FOR_YOU_LIST_LIMIT,
          sort: 'popularity',
          cursor: null,
          majorCategorySlug: profile.majorSlug,
          q: null,
          categorySlugs: categorySlugsForReadyCheck,
          radius: null,
          userId: null,
        }),
      ]);
      catalogSpecialistsCount = sp.specialists.length;
      catalogOrganizationsCount = org.organizations.length;
    }

    const homeBlockWouldRender =
      personalizationReady &&
      (catalogSpecialistsCount > 0 || catalogOrganizationsCount > 0);

    return {
      userId: user.id,
      email: user.email,
      profile,
      /** Сигналы, из которых собирается портрет (тот же смысл, что в `recomputeProfileForUser`). */
      inputsConsidered: {
        fromFavorites: [...fromFavorites].sort(),
        fromBookings,
        fromBehaviorEventsLast30Days: fromBehaviorEvents,
        behaviorEventRowsInWindow: behaviorHints.length,
      },
      /** Соответствие GET `/personalization/recommendations` без query-фильтров и UI главной. */
      readiness: {
        minCategorySlugsRequired: MIN_PROFILE_CATEGORY_SLUGS_FOR_RECOMMENDED,
        personalizationReady,
        /**
         * Как на клиенте: `personalizationReady` и непустая выдача (спец. и/или орг.).
         * Каталог смотрится в `locale` из тела (по умолчанию `en`, если не передан).
         */
        homeBlockWouldRender,
        catalogListLimitUsed: HOME_FOR_YOU_LIST_LIMIT,
        catalogLocale: locale,
        catalogSpecialistsCount,
        catalogOrganizationsCount,
        note:
          'Радиус на главной не передаётся — здесь `radius: null`, как в клиенте без гео в запросе.',
      },
    };
  }
}
