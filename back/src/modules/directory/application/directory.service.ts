import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublicationModerationStatus } from '@prisma/client';
import {
  DirectoryRepository,
  type DirectoryListRadiusFilter,
  type OrganizationListRow,
  type SpecialistListRow,
} from '../infrastructure/directory.repository';
import { mergeOrganizationMajorIdsAndSlugsFromDb } from '../../organizations/lib/merge-organization-major-categories';
import { normalizeDirectoryListingWorkdayBounds } from '../../../common/availability/directory-listing-workday';
import { listingCardPreviewWindowMs } from '../../../common/availability/listing-slot-policy';
import {
  decodeOrganizationListCursor,
  decodeSpecialistListCursor,
  encodeOrganizationListCursor,
  encodeSpecialistListCursor,
  type DecodedSpecialistListCursor,
} from '../../../common/pagination/directory-list-cursor-codec';
import {
  decodeDirectoryIndexedSpecialistsCursor,
  encodeDirectoryIndexedSpecialistsCursor,
} from '../../../common/pagination/directory-indexed-specialists-cursor';
import type { DirectoryListSort } from '../../../common/pagination/directory-list-sort';
import { PersonalizationService } from '../../personalization/application/personalization.service';
import { MarketplaceListingEdgesIndexService } from './marketplace-listing-edges-index.service';
import {
  directorySpecialistListedBio,
  directorySpecialistListedExperienceYears,
  directorySpecialistListedImageAlt,
  directorySpecialistListedImageUrl,
  directorySpecialistListedListingName,
} from '../lib/directory-specialist-listed-profile';
import {
  decodeReviewListCursor,
  encodeReviewListCursor,
} from '../../../common/pagination/review-list-cursor-codec';
import type { ApiLocale } from '../../../common/i18n';
import {
  pickLocalizedMajorName,
  pickLocalizedOrganizationListItem,
  resolveLocalizedString,
  pickLocalizedServiceCategoryFields,
  type CategoryLocaleShape,
  type OrganizationLocaleListShape,
} from '../../../common/i18n';
import { buildListingSlotGroupsFromOccupiedKeys } from '../domain/build-occupied-listing-slot-groups';
import {
  computeAvailableListingSlotKeysPerSpecialist,
  mergeCalendarEventsToOccupiedKeysPerSpecialist,
} from '../domain/workday-free-slots';
import type { CatalogFilterOptionsResponseDto } from '../dto/catalog-filter-options-response.dto';
import type { DirectoryBodyZoneTagDto } from '../dto/directory-body-zone-tag.dto';
import type { DirectoryCategoryTagDto } from '../dto/directory-category-tag.dto';
import type {
  OrganizationDetailResponseDto,
  OrganizationStaffMemberDto,
} from '../dto/organization-detail-response.dto';
import type {
  OrganizationListItemDto,
  SpecialistOccupiedSlotKeysEntryDto,
} from '../dto/organizations-list-response.dto';
import type { DirectoryReviewsListResponseDto } from '../dto/directory-reviews-list-response.dto';
import type { OrganizationsListResponseDto } from '../dto/organizations-list-response.dto';
import type {
  SpecialistBookableServiceDto,
  SpecialistListItemDto,
} from '../dto/specialists-list-response.dto';
import type { SpecialistsListResponseDto } from '../dto/specialists-list-response.dto';
import type {
  OrganizationListApiFilters,
  SpecialistListApiFilters,
} from '../infrastructure/directory-list-query-filters';

function specialistListFiltersOrNull(
  locale: ApiLocale,
  majorCategorySlug: string | null,
  q: string | null,
  categorySlugs: string[],
  bodyZoneSlugs: string[],
  gender: 'male' | 'female' | null,
  priceMinVnd: number | null,
  priceMaxVnd: number | null,
): SpecialistListApiFilters | null {
  const hasMajor = majorCategorySlug != null && majorCategorySlug !== '';
  const has =
    hasMajor ||
    (q != null && q !== '') ||
    categorySlugs.length > 0 ||
    bodyZoneSlugs.length > 0 ||
    gender != null ||
    priceMinVnd != null ||
    priceMaxVnd != null;
  if (!has) {
    return null;
  }
  return {
    majorCategorySlug: hasMajor ? majorCategorySlug : null,
    q,
    categorySlugs,
    bodyZoneSlugs,
    gender,
    priceMinVnd,
    priceMaxVnd,
    locale,
  };
}

function organizationListFiltersOrNull(
  locale: ApiLocale,
  majorCategorySlug: string | null,
  q: string | null,
  categorySlugs: string[],
  bodyZoneSlugs: string[],
): OrganizationListApiFilters | null {
  const hasMajor = majorCategorySlug != null && majorCategorySlug !== '';
  const has =
    hasMajor ||
    (q != null && q !== '') ||
    categorySlugs.length > 0 ||
    bodyZoneSlugs.length > 0;
  if (!has) {
    return null;
  }
  return {
    majorCategorySlug: hasMajor ? majorCategorySlug : null,
    q,
    categorySlugs,
    bodyZoneSlugs,
    locale,
  };
}

function joinLocalizedCategoryShortNames(
  links: { serviceCategory: CategoryLocaleShape }[],
  locale: ApiLocale,
): string {
  if (links.length === 0) {
    return '';
  }
  const names = links.map(
    (l) =>
      pickLocalizedServiceCategoryFields(l.serviceCategory, locale).shortName,
  );
  return [...new Set(names)].join(', ');
}

/** Мастер на карточке салона: витрина + текущее место приёма = этот салон. */
function isVitrineStaffAtOrganization(
  e: OrganizationListRow['specialistEmployments'][number],
  organizationId: string,
): boolean {
  const activeWorkplaceOrgId =
    e.specialist.workplaces[0]?.organizationId ?? null;
  return (
    e.isActive &&
    e.specialist.listedInDirectory &&
    activeWorkplaceOrgId === organizationId
  );
}

/**
 * Кого показывать в блоке «сотрудники» профиля организации.
 * Гость — витрина (место приёма = салон и флаг записи в каталоге).
 * Владелец БД — всё активное членство с **текущим местом приёма = этот салон**;
 * исключаем тех, кто только числится в employment, но снял workplace.
 */
function specialistEmploymentsForOrganizationStaffSection(
  employments: OrganizationListRow['specialistEmployments'],
  organizationId: string,
  viewerOwnsOrganization: boolean,
): OrganizationListRow['specialistEmployments'] {
  return employments.filter((e) => {
    if (!e.isActive) {
      return false;
    }
    if (e.specialist.workplaces[0]?.organizationId !== organizationId) {
      return false;
    }
    if (viewerOwnsOrganization) {
      return true;
    }
    return e.specialist.listedInDirectory;
  });
}

function mapDirectoryCategoryTags(
  links: { serviceCategory: CategoryLocaleShape }[],
  locale: ApiLocale,
): DirectoryCategoryTagDto[] {
  return links.map((l) => {
    const c = pickLocalizedServiceCategoryFields(l.serviceCategory, locale);
    return { slug: c.slug, shortName: c.shortName };
  });
}

function isVndPriceOption(p: { currency: string }): boolean {
  return (p.currency ?? 'VND').toUpperCase() === 'VND';
}

function mapMarketplaceOfferingEdgesToBookable(
  specialist: SpecialistBookableSource,
  locale: ApiLocale,
): SpecialistBookableServiceDto[] {
  type Edge = NonNullable<
    SpecialistBookableSource['offeringsExecution']
  >[number];
  const edges: Edge[] | undefined = specialist.offeringsExecution;
  if (edges == null || edges.length === 0) {
    return [];
  }
  const orgId = specialist.workplaces[0]?.organization.id ?? null;
  if (orgId == null) {
    return [];
  }

  const out: SpecialistBookableServiceDto[] = [];
  for (const edge of edges) {
    const off = edge.organizationOffering;
    if (off.organizationId !== orgId) {
      continue;
    }
    const vndOpts = (off.priceOptions ?? []).filter(isVndPriceOption);
    if (vndOpts.length === 0) {
      continue;
    }
    const priceByOption = new Map<string, number>();
    for (const po of edge.priceOverrides) {
      priceByOption.set(po.offeringPriceOptionId, po.customPrice);
    }

    const category = off.category;
    const major = category?.majorServiceCategory;
    const majorSlug = major?.slug?.trim() ?? '';
    const majorName =
      major != null
        ? pickLocalizedMajorName(
            major as Parameters<typeof pickLocalizedMajorName>[0],
            locale,
          ).trim()
        : '';

    let catShort = '';
    if (category != null) {
      catShort =
        pickLocalizedServiceCategoryFields(
          category as CategoryLocaleShape,
          locale,
        ).shortName.trim() ?? '';
    }
    const rawTitle = off.title.trim();
    const slug = off.slug.trim();
    const categoryShortName =
      rawTitle.length > 0 ? rawTitle : catShort.length > 0 ? catShort : slug;

    const durationMinutes = vndOpts.map((p) => p.durationMinutes);
    const priceVndByDuration = vndOpts.map(
      (p) => priceByOption.get(p.id) ?? p.priceAmount,
    );

    out.push({
      id: off.id,
      categoryShortName,
      majorSlug,
      majorName: majorName || majorSlug || categoryShortName,
      majorSortOrder: major?.sortOrder ?? 0,
      durationMinutes,
      priceVndByDuration,
      organizationOfferingId: off.id,
      marketplaceOfferingPriceOptionIds: vndOpts.map((p) => p.id),
    });
  }
  return out;
}

/**
 * При привязке к салону витринные подкатегории мастера = SSC ∩ OSC с покрытием (как у карточки организации).
 * Без привязки — все сохранённые теги SSC.
 */
function specialistStorefrontFilteredServiceCategories(
  s: SpecialistListRow,
  storefrontCategoryIdsByOrg?: Map<string, Set<string>>,
): SpecialistListRow['skills'] {
  const orgId = s.workplaces[0]?.organizationId ?? null;
  if (orgId == null || storefrontCategoryIdsByOrg == null) {
    return s.skills;
  }
  const visible = storefrontCategoryIdsByOrg.get(orgId) ?? new Set<string>();
  return s.skills.filter((link) => visible.has(link.serviceCategoryId));
}

type SpecialistBookableSource = Pick<
  SpecialistListRow,
  'workplaces' | 'offeringsExecution'
>;

/** Услуги для записи: опубликованные офферы активной точки + назначения `SpecialistOffering`. */
function mapSpecialistOwnBookableServices(
  specialist: SpecialistBookableSource,
  locale: ApiLocale,
): SpecialistBookableServiceDto[] {
  return mapMarketplaceOfferingEdgesToBookable(specialist, locale);
}

function mapSpecialistRowToListItem(
  s: SpecialistListRow,
  locale: ApiLocale,
  now: Date,
  occupiedKeys: Set<string>,
  doneClientsCount: number,
  opts?: { listedNameMode: 'public_catalog' | 'raw_account' },
  storefrontCategoryIdsByOrg?: Map<string, Set<string>>,
): SpecialistListItemDto {
  const slotGroups = buildListingSlotGroupsFromOccupiedKeys(occupiedKeys, now);

  const loc = s.workplaces[0]?.organization ?? null;
  const addr = loc?.address;
  const addressLine = addr?.addressLine ?? null;
  const city = addr?.city ?? null;
  const latitude = addr?.latitude ?? null;
  const longitude = addr?.longitude ?? null;

  const vitrineSvcCategories = specialistStorefrontFilteredServiceCategories(
    s,
    storefrontCategoryIdsByOrg,
  );
  const categoriesLine = joinLocalizedCategoryShortNames(
    vitrineSvcCategories,
    locale,
  );
  const metaLine =
    [addressLine, city].filter((x) => x?.trim()).join(', ') ||
    directorySpecialistListedBio(s)?.trim() ||
    '';
  const servicesLine = categoriesLine || '';
  const listingWd = normalizeDirectoryListingWorkdayBounds(
    loc?.listingWorkdayStartMinute,
    loc?.listingWorkdayEndMinute,
  );
  const phone = loc?.phone?.trim() || s.user.phone?.trim() || null;
  const activeWorkplace = loc ? { id: loc.id, name: loc.name.trim() } : null;
  const listedName =
    opts?.listedNameMode === 'raw_account'
      ? (s.listingName ?? '').trim()
      : directorySpecialistListedListingName(s);
  const listedBio = directorySpecialistListedBio(s);
  const listedYears = directorySpecialistListedExperienceYears(s);
  const listedImg = directorySpecialistListedImageUrl(s);
  const listedImgAlt = directorySpecialistListedImageAlt(s);
  return {
    id: s.id,
    userId: s.userId,
    name: listedName,
    bio: listedBio,
    experienceYears: listedYears,
    doneClientsCount,
    ratingAverage: s.ratingAverage,
    rating: s.ratingAverage,
    reviewsCount: s.reviewsCount,
    latitude,
    longitude,
    addressLine,
    city,
    phone,
    imageUrl: listedImg,
    imageAlt: listedImgAlt,
    gender: s.gender ?? null,
    metaLine,
    servicesLine,
    categories: mapDirectoryCategoryTags(vitrineSvcCategories, locale),
    slotGroups,
    bookableServices: mapSpecialistOwnBookableServices(s, locale),
    autoConfirmBookings: s.autoConfirmBookings,
    listingWorkdayStartMinute: listingWd.startMinute,
    listingWorkdayEndMinute: listingWd.endMinute,
    activeWorkplace,
  };
}

function mapOrganizationRowToListItem(
  o: OrganizationListRow,
  locale: ApiLocale,
  now: Date,
  occupiedMap: Map<string, Set<string>>,
  availableMap: Map<string, Set<string>>,
  storefront: { imageUrl: string | null; imageAlt: string | null },
  /** Подмножество OSC с покрытием мастером — только они на витрине. */
  storefrontCategoryIds: Set<string>,
  opts?: {
    /** Если задан — `specialistOccupiedSlotKeys` по этим id; иначе только витринные мастера. */
    specialistIdsForOccupancyPreview?: string[];
  },
): OrganizationListItemDto {
  const localized = pickLocalizedOrganizationListItem(
    {
      ...(o as unknown as OrganizationLocaleListShape),
      imageUrl: storefront.imageUrl,
      imageAlt: storefront.imageAlt,
    },
    locale,
  );
  const occupancySpecialistIds =
    opts?.specialistIdsForOccupancyPreview ??
    o.specialistEmployments
      .filter((e) => isVitrineStaffAtOrganization(e, o.id))
      .map((e) => e.specialist.id);
  const specialistOccupiedSlotKeys: SpecialistOccupiedSlotKeysEntryDto[] =
    occupancySpecialistIds.map((specialistId) => ({
      specialistId,
      keys: [...(occupiedMap.get(specialistId) ?? new Set())].sort((a, b) =>
        a.localeCompare(b),
      ),
    }));
  const organizationAvailableSlotKeys = new Set<string>();
  for (const specialistId of occupancySpecialistIds) {
    for (const key of availableMap.get(specialistId) ?? []) {
      organizationAvailableSlotKeys.add(key);
    }
  }

  const vitrineLinks = o.serviceCategories.filter((l) =>
    storefrontCategoryIds.has(l.serviceCategoryId),
  );
  const categoriesLine = joinLocalizedCategoryShortNames(vitrineLinks, locale);
  const metaLine =
    [o.address?.addressLine, localized.city]
      .filter((x) => x?.trim())
      .join(', ') || '';
  const servicesLine = categoriesLine || localized.description?.trim() || '';
  const orgWd = normalizeDirectoryListingWorkdayBounds(
    o.listingWorkdayStartMinute,
    o.listingWorkdayEndMinute,
  );
  return {
    id: localized.id,
    slug: o.slug,
    majorCategorySlugs: mergeOrganizationMajorIdsAndSlugsFromDb(o).slugs,
    name: localized.name,
    description: localized.description,
    city: localized.city,
    addressLine: o.address?.addressLine ?? null,
    phone: o.phone,
    email: o.email,
    website: o.website,
    yearsInBusiness: o.yearsInBusiness,
    latitude: localized.latitude,
    longitude: localized.longitude,
    ratingAverage: localized.ratingAverage,
    rating: localized.ratingAverage,
    reviewsCount: localized.reviewsCount,
    imageUrl: localized.imageUrl,
    imageAlt: localized.imageAlt,
    metaLine,
    servicesLine,
    categories: mapDirectoryCategoryTags(vitrineLinks, locale),
    slotGroups: buildListingSlotGroupsFromOccupiedKeys(
      organizationAvailableSlotKeys,
      now,
    ),
    specialistOccupiedSlotKeys,
    listingWorkdayStartMinute: orgWd.startMinute,
    listingWorkdayEndMinute: orgWd.endMinute,
  };
}

function mapSpecialistToStaffMember(
  s: OrganizationListRow['specialistEmployments'][number]['specialist'],
  locale: ApiLocale,
  /** Строка локации салона (карточка сотрудника привязана к этой организации). */
  organizationMetaLine: string,
  occupiedKeys: Set<string>,
  availableKeys: Set<string>,
  /** Владелец салона видит «живые» имена мастеров; гости — витринные (заморозка при pending). */
  viewerIsOrganizationOwner: boolean,
): OrganizationStaffMemberDto {
  const staffBio = directorySpecialistListedBio(s);
  const staffImg = directorySpecialistListedImageUrl(s);
  const metaLine = organizationMetaLine.trim() || staffBio?.trim() || '';
  const displayName = viewerIsOrganizationOwner
    ? (s.listingName ?? '').trim()
    : directorySpecialistListedListingName(s);
  return {
    id: s.id,
    userId: s.userId,
    name: displayName,
    rating: s.ratingAverage,
    metaLine,
    imageUrl: staffImg,
    bookableServices: mapSpecialistOwnBookableServices(s, locale),
    occupiedListingSlotKeys: [...occupiedKeys].sort(),
    availableListingSlotKeys: [...availableKeys].sort(),
  };
}

@Injectable()
export class DirectoryService {
  private readonly logger = new Logger(DirectoryService.name);

  constructor(
    @Inject(forwardRef(() => DirectoryRepository))
    private readonly directoryRepository: DirectoryRepository,
    @Inject(ConfigService)
    private readonly config: ConfigService,
    @Inject(forwardRef(() => PersonalizationService))
    private readonly personalizationService: PersonalizationService,
    private readonly marketplaceListingEdgesIndex: MarketplaceListingEdgesIndexService,
  ) {}

  private useIndexedSpecialistListing(): boolean {
    const isIndexed =
      this.config.get<string>('search.listingBackend', 'sql') === 'indexed';
    const key = this.config.get<string>('search.typesense.apiKey', '').trim();
    const ok = Boolean(key);
    if (isIndexed && !ok) {
      this.logger.warn(
        'SEARCH_LISTING_BACKEND=indexed при пустом TYPESENSE_API_KEY — список мастеров остаётся на SQL',
      );
    }
    return isIndexed && ok;
  }

  /** Дни превью слотов на карточках списка / главной / поиска. */
  private getListingCardPreviewCalendarDays(): number {
    const raw = this.config.get<number>('listingCardPreview.calendarDays');
    const fallback = 1;
    const n = raw ?? fallback;
    return Math.max(
      1,
      Math.min(90, Math.floor(Number.isFinite(n) ? n : fallback)),
    );
  }

  /** Дни превью на GET организации / специалиста (полный профиль). */
  private getProfileSlotPreviewCalendarDays(): number {
    const raw = this.config.get<number>('profileSlotPreview.calendarDays');
    const fallback = 14;
    const n = raw ?? fallback;
    return Math.max(
      1,
      Math.min(90, Math.floor(Number.isFinite(n) ? n : fallback)),
    );
  }

  /**
   * Единый горизонт дней для занятости в каталоге (сетка + ключи, которые отдаёт API).
   * Синхронизировано с клиентом: {@link getUnifiedDirectorySlotPreviewCalendarDays}.
   */
  private getUnifiedDirectorySlotPreviewCalendarDays(): number {
    return Math.max(
      this.getListingCardPreviewCalendarDays(),
      this.getProfileSlotPreviewCalendarDays(),
    );
  }

  /** Список мастеров из Typesense: курсор — страница группированного поиска (v3, `kb: didx_edge`). */
  private async listSpecialistsIndexed(
    locale: ApiLocale,
    options: {
      limit: number;
      sort: DirectoryListSort;
      radius: DirectoryListRadiusFilter | null;
    },
    now: Date,
    filters: SpecialistListApiFilters | null,
    indexedPage: number,
  ): Promise<SpecialistsListResponseDto> {
    const limit = options.limit;
    const fetch = limit + 1;
    const [{ specialistIds: ids }, matchingCount] = await Promise.all([
      this.marketplaceListingEdgesIndex.searchSpecialistsGrouped({
        sort: options.sort,
        page: indexedPage,
        perPageGroups: fetch,
        locale,
        filters,
        radius: options.radius,
      }),
      this.directoryRepository.countSpecialistsForDirectoryList({
        filters,
        radius: options.radius,
      }),
    ]);
    const hasMore = ids.length > limit;
    const idPage = hasMore ? ids.slice(0, limit) : ids;
    const rowMap = new Map<string, SpecialistListRow>();
    await Promise.all(
      idPage.map(async (id) => {
        const row =
          await this.directoryRepository.findSpecialistListRowById(id);
        if (row != null) {
          rowMap.set(id, row);
        }
      }),
    );
    const slice = idPage
      .map((id) => rowMap.get(id))
      .filter((r): r is SpecialistListRow => r != null);
    const nextCursor = hasMore
      ? encodeDirectoryIndexedSpecialistsCursor(options.sort, indexedPage + 1)
      : null;

    const occupiedBySpecialist = await this.buildOccupiedBySpecialistMap(
      slice.map((s) => s.id),
      now,
      this.getUnifiedDirectorySlotPreviewCalendarDays(),
    );
    const doneClientsBySpec =
      await this.directoryRepository.countDistinctDoneClientsBySpecialistIds(
        slice.map((s) => s.id),
      );
    const storefrontOrgIds = [
      ...new Set(
        slice
          .map((s) => s.workplaces[0]?.organizationId ?? null)
          .filter(
            (id): id is string => typeof id === 'string' && id.length > 0,
          ),
      ),
    ];
    const storefrontCategoryIdsByOrg =
      await this.directoryRepository.findOrganizationStorefrontCategoryIdMap(
        storefrontOrgIds,
      );
    return {
      specialists: slice.map((s) =>
        mapSpecialistRowToListItem(
          s,
          locale,
          now,
          occupiedBySpecialist.get(s.id) ?? new Set(),
          doneClientsBySpec.get(s.id) ?? 0,
          undefined,
          storefrontCategoryIdsByOrg,
        ),
      ),
      cursorPage: { nextCursor, hasMore },
      matchingCount,
    };
  }

  private encodeSpecialistListNextCursor(
    sort: DirectoryListSort,
    limit: number,
    decoded: ReturnType<typeof decodeSpecialistListCursor>,
    last: SpecialistListRow,
  ): string {
    if (
      sort === 'recommended' ||
      sort === 'price_asc' ||
      sort === 'price_desc'
    ) {
      const base = decoded != null && 'offset' in decoded ? decoded.offset : 0;
      return encodeSpecialistListCursor({
        sort,
        specialistId: last.id,
        offset: base + limit,
      });
    }
    if (sort === 'popularity') {
      return encodeSpecialistListCursor({
        sort: 'popularity',
        specialistId: last.id,
        reviewsCount: last.reviewsCount,
        ratingAverage: last.ratingAverage,
      });
    }
    if (sort === 'newest') {
      return encodeSpecialistListCursor({
        sort: 'newest',
        specialistId: last.id,
        createdAt: last.createdAt,
      });
    }
    return encodeSpecialistListCursor({
      sort: 'rating',
      specialistId: last.id,
      ratingAverage: last.ratingAverage,
    });
  }

  private encodeOrganizationListNextCursor(
    sort: DirectoryListSort,
    limit: number,
    decoded: ReturnType<typeof decodeOrganizationListCursor>,
    last: OrganizationListRow,
  ): string {
    if (
      sort === 'recommended' ||
      sort === 'price_asc' ||
      sort === 'price_desc'
    ) {
      const base = decoded != null && 'offset' in decoded ? decoded.offset : 0;
      return encodeOrganizationListCursor({
        sort,
        organizationId: last.id,
        offset: base + limit,
      });
    }
    if (sort === 'popularity') {
      return encodeOrganizationListCursor({
        sort: 'popularity',
        organizationId: last.id,
        reviewsCount: last.reviewsCount,
        ratingAverage: last.ratingAverage,
      });
    }
    if (sort === 'newest') {
      return encodeOrganizationListCursor({
        sort: 'newest',
        organizationId: last.id,
        createdAt: last.createdAt,
      });
    }
    return encodeOrganizationListCursor({
      sort: 'rating',
      organizationId: last.id,
      ratingAverage: last.ratingAverage,
    });
  }

  private async buildOccupiedBySpecialistMap(
    specialistIds: string[],
    now: Date,
    calendarDays: number,
  ): Promise<Map<string, Set<string>>> {
    const previewWindowMs = listingCardPreviewWindowMs(calendarDays);
    const calendarEventRows =
      await this.directoryRepository.findBlockingCalendarEventsForListingOccupancy(
        specialistIds,
        now,
        previewWindowMs,
      );
    return mergeCalendarEventsToOccupiedKeysPerSpecialist(calendarEventRows);
  }

  private async buildAvailableBySpecialistMap(
    specialistIds: string[],
    now: Date,
    calendarDays: number,
    occupiedBySpecialist: Map<string, Set<string>>,
  ): Promise<Map<string, Set<string>>> {
    const availability =
      await this.directoryRepository.findActiveSpecialistResourceAvailabilityForListing(
        specialistIds,
      );
    return computeAvailableListingSlotKeysPerSpecialist({
      ...availability,
      occupiedBySpecialist,
      now,
      calendarDays,
    });
  }

  async listSpecialists(
    locale: ApiLocale,
    options: {
      limit: number;
      sort: DirectoryListSort;
      cursor: string | null;
      majorCategorySlug: string | null;
      q: string | null;
      categorySlugs: string[];
      bodyZoneSlugs: string[];
      gender: 'male' | 'female' | null;
      priceMinVnd: number | null;
      priceMaxVnd: number | null;
      radius: DirectoryListRadiusFilter | null;
      /** Пользователь (Bearer) — нужен для `sort=recommended`. */
      userId: string | null;
      /**
       * true, если `priceMinVnd`/`priceMaxVnd` заданы в query; иначе при рекомендациях
       * подмешивается цена из портрета.
       */
      priceFromQuery: boolean;
    },
  ): Promise<SpecialistsListResponseDto> {
    const now = new Date();
    const useIndexedListing =
      this.useIndexedSpecialistListing() &&
      options.sort !== 'recommended' &&
      options.bodyZoneSlugs.length === 0;

    const rawCursor = options.cursor?.trim() || null;

    let decodedSql: DecodedSpecialistListCursor | null = null;
    let indexedPage = 1;

    if (useIndexedListing) {
      if (rawCursor != null) {
        const idx = decodeDirectoryIndexedSpecialistsCursor(rawCursor);
        if (idx == null) {
          throw new BadRequestException({
            code: 'INVALID_CURSOR',
            message:
              'Invalid cursor (indexed listing expects listing-edge page cursors only)',
          });
        }
        if (idx.sort !== options.sort) {
          throw new BadRequestException({
            code: 'INVALID_CURSOR',
            message: 'Cursor does not match sort',
          });
        }
        indexedPage = idx.page;
      }
    } else {
      decodedSql =
        rawCursor == null ? null : decodeSpecialistListCursor(rawCursor);
      if (rawCursor != null && decodedSql == null) {
        throw new BadRequestException({
          code: 'INVALID_CURSOR',
          message: 'Invalid cursor',
        });
      }
      if (decodedSql != null && decodedSql.sort !== options.sort) {
        throw new BadRequestException({
          code: 'INVALID_CURSOR',
          message: 'Cursor does not match sort',
        });
      }
    }

    if (options.sort === 'recommended') {
      if (options.userId == null || options.userId.trim() === '') {
        throw new BadRequestException({
          code: 'RECOMMENDED_AUTH_REQUIRED',
          message: 'sort=recommended requires an authenticated user',
        });
      }
    }
    let listPriceMin = options.priceMinVnd;
    let listPriceMax = options.priceMaxVnd;
    let overlapCategorySlugs: string[] | undefined;
    if (options.sort === 'recommended' && options.userId != null) {
      const res =
        await this.personalizationService.resolveRecommendationListing(
          options.userId,
          {
            majorSlug: options.majorCategorySlug,
            categorySlugs:
              options.categorySlugs.length > 0 ? options.categorySlugs : null,
            radius: options.radius,
            vndPriceOverride: options.priceFromQuery
              ? {
                  priceMinVnd: options.priceMinVnd,
                  priceMaxVnd: options.priceMaxVnd,
                }
              : null,
          },
        );
      if (!res.personalizationReady) {
        throw new BadRequestException({
          code: 'RECOMMENDED_SORT_UNAVAILABLE',
          message: 'Personalized sort is not available for this user',
        });
      }
      if (!options.priceFromQuery) {
        listPriceMin = res.priceMinVnd;
        listPriceMax = res.priceMaxVnd;
      }
      overlapCategorySlugs = res.categorySlugsUsed;
    }
    const limit = options.limit;
    const filters = specialistListFiltersOrNull(
      locale,
      options.majorCategorySlug,
      options.q,
      options.categorySlugs,
      options.bodyZoneSlugs,
      options.gender,
      listPriceMin,
      listPriceMax,
    );

    if (useIndexedListing) {
      return this.listSpecialistsIndexed(
        locale,
        options,
        now,
        filters,
        indexedPage,
      );
    }

    const [matchingCount, rows] = await Promise.all([
      this.directoryRepository.countSpecialistsForDirectoryList({
        filters,
        radius: options.radius,
      }),
      this.directoryRepository.findSpecialistsPage({
      take: limit + 1,
      sort: options.sort,
      cursor: decodedSql,
      filters,
      radius: options.radius,
      overlapCategorySlugs,
    }),
    ]);
    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    const occupiedBySpecialist = await this.buildOccupiedBySpecialistMap(
      slice.map((s) => s.id),
      now,
      this.getUnifiedDirectorySlotPreviewCalendarDays(),
    );
    const last = slice[slice.length - 1];
    const nextCursor =
      hasMore && last
        ? this.encodeSpecialistListNextCursor(
            options.sort,
            limit,
            decodedSql,
            last,
          )
        : null;
    const doneClientsBySpec =
      await this.directoryRepository.countDistinctDoneClientsBySpecialistIds(
        slice.map((s) => s.id),
      );
    const storefrontOrgIds = [
      ...new Set(
        slice
          .map((s) => s.workplaces[0]?.organizationId ?? null)
          .filter(
            (id): id is string => typeof id === 'string' && id.length > 0,
          ),
      ),
    ];
    const storefrontCategoryIdsByOrg =
      await this.directoryRepository.findOrganizationStorefrontCategoryIdMap(
        storefrontOrgIds,
      );
    return {
      specialists: slice.map((s) =>
        mapSpecialistRowToListItem(
          s,
          locale,
          now,
          occupiedBySpecialist.get(s.id) ?? new Set(),
          doneClientsBySpec.get(s.id) ?? 0,
          undefined,
          storefrontCategoryIdsByOrg,
        ),
      ),
      cursorPage: { nextCursor, hasMore },
      matchingCount,
    };
  }

  async listOrganizations(
    locale: ApiLocale,
    options: {
      limit: number;
      sort: DirectoryListSort;
      cursor: string | null;
      majorCategorySlug: string | null;
      q: string | null;
      categorySlugs: string[];
      bodyZoneSlugs: string[];
      radius: DirectoryListRadiusFilter | null;
      userId: string | null;
    },
  ): Promise<OrganizationsListResponseDto> {
    const now = new Date();
    const rawCursor = options.cursor?.trim() || null;
    const decoded =
      rawCursor == null ? null : decodeOrganizationListCursor(rawCursor);
    if (rawCursor != null && decoded == null) {
      throw new BadRequestException({
        code: 'INVALID_CURSOR',
        message: 'Invalid cursor',
      });
    }
    if (decoded != null && decoded.sort !== options.sort) {
      throw new BadRequestException({
        code: 'INVALID_CURSOR',
        message: 'Cursor does not match sort',
      });
    }
    if (options.sort === 'recommended') {
      if (options.userId == null || options.userId.trim() === '') {
        throw new BadRequestException({
          code: 'RECOMMENDED_AUTH_REQUIRED',
          message: 'sort=recommended requires an authenticated user',
        });
      }
    }
    let overlapCategorySlugs: string[] | undefined;
    if (options.sort === 'recommended' && options.userId != null) {
      const res =
        await this.personalizationService.resolveRecommendationListing(
          options.userId,
          {
            majorSlug: options.majorCategorySlug,
            categorySlugs:
              options.categorySlugs.length > 0 ? options.categorySlugs : null,
            radius: options.radius,
            vndPriceOverride: null,
          },
        );
      if (!res.personalizationReady) {
        throw new BadRequestException({
          code: 'RECOMMENDED_SORT_UNAVAILABLE',
          message: 'Personalized sort is not available for this user',
        });
      }
      overlapCategorySlugs = res.categorySlugsUsed;
    }
    const limit = options.limit;
    const filters = organizationListFiltersOrNull(
      locale,
      options.majorCategorySlug,
      options.q,
      options.categorySlugs,
      options.bodyZoneSlugs,
    );
    const [matchingCount, rows] = await Promise.all([
      this.directoryRepository.countOrganizationsForDirectoryList({
        filters,
        radius: options.radius,
      }),
      this.directoryRepository.findOrganizationsPage({
      take: limit + 1,
      sort: options.sort,
      cursor: decoded,
      filters,
      radius: options.radius,
      overlapCategorySlugs,
    }),
    ]);
    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    const specialistIds = new Set<string>();
    for (const o of slice) {
      for (const e of o.specialistEmployments) {
        if (isVitrineStaffAtOrganization(e, o.id)) {
          specialistIds.add(e.specialist.id);
        }
      }
    }
    const occupiedBySpecialist = await this.buildOccupiedBySpecialistMap(
      [...specialistIds],
      now,
      this.getUnifiedDirectorySlotPreviewCalendarDays(),
    );
    const availableBySpecialist = await this.buildAvailableBySpecialistMap(
      [...specialistIds],
      now,
      this.getUnifiedDirectorySlotPreviewCalendarDays(),
      occupiedBySpecialist,
    );
    const last = slice[slice.length - 1];
    const nextCursor =
      hasMore && last
        ? this.encodeOrganizationListNextCursor(
            options.sort,
            limit,
            decoded,
            last,
          )
        : null;
    const storefrontByOrg =
      await this.directoryRepository.findStorefrontImageFieldsForOrganizationIds(
        slice.map((o) => o.id),
      );
    const storefrontCategoriesByOrg =
      await this.directoryRepository.findOrganizationStorefrontCategoryIdMap(
        slice.map((o) => o.id),
      );
    return {
      organizations: slice.map((o) =>
        mapOrganizationRowToListItem(
          o,
          locale,
          now,
          occupiedBySpecialist,
          availableBySpecialist,
          storefrontByOrg.get(o.id) ?? {
            imageUrl: null,
            imageAlt: null,
          },
          storefrontCategoriesByOrg.get(o.id) ?? new Set<string>(),
        ),
      ),
      cursorPage: { nextCursor, hasMore },
      matchingCount,
    };
  }

  async getSpecialistById(
    locale: ApiLocale,
    id: string,
    viewerUserId?: string | null,
  ): Promise<SpecialistListItemDto | null> {
    const now = new Date();
    const row =
      await this.directoryRepository.findSpecialistByIdForDirectoryDetail(
        id,
        viewerUserId ?? null,
      );
    if (!row) {
      return null;
    }
    const occupiedBySpecialist = await this.buildOccupiedBySpecialistMap(
      [id],
      now,
      this.getUnifiedDirectorySlotPreviewCalendarDays(),
    );
    const doneBySpec =
      await this.directoryRepository.countDistinctDoneClientsBySpecialistIds([
        id,
      ]);
    const orgIdRow = row.workplaces[0]?.organizationId ?? null;
    const storefrontCategoryIdsByOrg =
      typeof orgIdRow === 'string' && orgIdRow.length > 0
        ? await this.directoryRepository.findOrganizationStorefrontCategoryIdMap(
            [orgIdRow],
          )
        : new Map<string, Set<string>>();
    const isOwner = viewerUserId != null && row.userId === viewerUserId;
    const dto = mapSpecialistRowToListItem(
      row,
      locale,
      now,
      occupiedBySpecialist.get(id) ?? new Set(),
      doneBySpec.get(id) ?? 0,
      {
        listedNameMode: isOwner ? 'raw_account' : 'public_catalog',
      },
      storefrontCategoryIdsByOrg,
    );

    const pendingWorkplace =
      isOwner &&
      row.workplaces[0]?.organization &&
      row.workplaces[0].organization.publicationModerationStatus !==
        PublicationModerationStatus.approved;

    if (!pendingWorkplace) {
      return dto;
    }

    return {
      ...dto,
      activeWorkplacePublicationModerationStatus:
        row.workplaces[0].organization.publicationModerationStatus,
    };
  }

  async getOrganizationById(
    locale: ApiLocale,
    id: string,
    viewerUserId?: string | null,
  ): Promise<OrganizationDetailResponseDto | null> {
    const now = new Date();
    const row =
      await this.directoryRepository.findOrganizationByIdForDirectoryDetail(
        id,
        viewerUserId ?? null,
      );
    if (!row) {
      return null;
    }

    const isOwner =
      viewerUserId != null &&
      row.ownerUserId != null &&
      row.ownerUserId === viewerUserId;

    const staffEmployments = specialistEmploymentsForOrganizationStaffSection(
      row.specialistEmployments,
      row.id,
      isOwner,
    );
    const specialistIds = staffEmployments.map((e) => e.specialist.id);
    const occupiedBySpecialist = await this.buildOccupiedBySpecialistMap(
      specialistIds,
      now,
      this.getUnifiedDirectorySlotPreviewCalendarDays(),
    );
    const availableBySpecialist = await this.buildAvailableBySpecialistMap(
      specialistIds,
      now,
      this.getUnifiedDirectorySlotPreviewCalendarDays(),
      occupiedBySpecialist,
    );
    const storefrontByOrg =
      await this.directoryRepository.findStorefrontImageFieldsForOrganizationIds(
        [id],
      );
    const storefrontCategoriesByOrg =
      await this.directoryRepository.findOrganizationStorefrontCategoryIdMap([
        id,
      ]);
    const storefront = storefrontByOrg.get(id) ?? {
      imageUrl: null,
      imageAlt: null,
    };
    const base = mapOrganizationRowToListItem(
      row,
      locale,
      now,
      occupiedBySpecialist,
      availableBySpecialist,
      storefront,
      storefrontCategoriesByOrg.get(id) ?? new Set<string>(),
      isOwner ? { specialistIdsForOccupancyPreview: specialistIds } : undefined,
    );
    // Гости: только витрина (запись через каталог). Владелец БД: весь активный персонал.
    const staff: OrganizationStaffMemberDto[] = staffEmployments.map((e) =>
      mapSpecialistToStaffMember(
        e.specialist,
        locale,
        base.metaLine,
        occupiedBySpecialist.get(e.specialist.id) ?? new Set(),
        availableBySpecialist.get(e.specialist.id) ?? new Set(),
        isOwner,
      ),
    );
    const clientsCount =
      await this.directoryRepository.countDistinctDoneClientsForOrganization(
        id,
      );
    const vitrineGalleryItems =
      await this.directoryRepository.findOrganizationVitrineGalleryItemsPublic(
        id,
      );

    const showModerationForOwner =
      isOwner &&
      row.publicationModerationStatus !== PublicationModerationStatus.approved;

    return {
      ...base,
      staff,
      clientsCount,
      vitrineGalleryItems,
      ...(showModerationForOwner
        ? { publicationModerationStatus: row.publicationModerationStatus }
        : {}),
    };
  }

  /**
   * Элементы списка витрины для избранных салонов (как у GET /organizations, без пагинации).
   * Порядок — как в избранном (по `createdAt` из `UserFavorite`).
   */
  async listListingItemsForFavoriteOrganizations(
    locale: ApiLocale,
    organizationIdsInFavoriteOrder: string[],
  ): Promise<OrganizationListItemDto[]> {
    const ids = organizationIdsInFavoriteOrder.filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    );
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.directoryRepository.findOrganizationsByIds(ids);
    const byId = new Map<string, OrganizationListRow>(
      rows.map((r): [string, OrganizationListRow] => [r.id, r]),
    );
    const now = new Date();
    const specialistIds = new Set<string>();
    for (const id of ids) {
      const o = byId.get(id);
      if (!o) {
        continue;
      }
      for (const e of o.specialistEmployments) {
        if (isVitrineStaffAtOrganization(e, o.id)) {
          specialistIds.add(e.specialist.id);
        }
      }
    }
    const occupiedBySpecialist = await this.buildOccupiedBySpecialistMap(
      [...specialistIds],
      now,
      this.getUnifiedDirectorySlotPreviewCalendarDays(),
    );
    const availableBySpecialist = await this.buildAvailableBySpecialistMap(
      [...specialistIds],
      now,
      this.getUnifiedDirectorySlotPreviewCalendarDays(),
      occupiedBySpecialist,
    );
    const storefrontByOrg =
      await this.directoryRepository.findStorefrontImageFieldsForOrganizationIds(
        ids,
      );
    const storefrontCategoriesByOrg =
      await this.directoryRepository.findOrganizationStorefrontCategoryIdMap(
        ids,
      );
    const out: OrganizationListItemDto[] = [];
    for (const id of ids) {
      const o = byId.get(id);
      if (!o) {
        continue;
      }
      out.push(
        mapOrganizationRowToListItem(
          o,
          locale,
          now,
          occupiedBySpecialist,
          availableBySpecialist,
          storefrontByOrg.get(id) ?? {
            imageUrl: null,
            imageAlt: null,
          },
          storefrontCategoriesByOrg.get(id) ?? new Set<string>(),
        ),
      );
    }
    return out;
  }

  /**
   * Элементы списка витрины для избранных мастеров (как у GET /specialists).
   */
  async listListingItemsForFavoriteSpecialists(
    locale: ApiLocale,
    specialistIdsInFavoriteOrder: string[],
  ): Promise<SpecialistListItemDto[]> {
    const ids = specialistIdsInFavoriteOrder.filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    );
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.directoryRepository.findSpecialistsByIds(ids);
    const byId = new Map<string, SpecialistListRow>(
      rows.map((r): [string, SpecialistListRow] => [r.id, r]),
    );
    const now = new Date();
    const occupiedBySpecialist = await this.buildOccupiedBySpecialistMap(
      ids,
      now,
      this.getUnifiedDirectorySlotPreviewCalendarDays(),
    );
    const doneBySpec =
      await this.directoryRepository.countDistinctDoneClientsBySpecialistIds(
        ids,
      );
    const storefrontOrgIds = [
      ...new Set(
        rows
          .map((r) => r.workplaces[0]?.organizationId ?? null)
          .filter(
            (oid): oid is string => typeof oid === 'string' && oid.length > 0,
          ),
      ),
    ];
    const storefrontCategoryIdsByOrg =
      await this.directoryRepository.findOrganizationStorefrontCategoryIdMap(
        storefrontOrgIds,
      );
    const out: SpecialistListItemDto[] = [];
    for (const id of ids) {
      const s = byId.get(id);
      if (!s) {
        continue;
      }
      if (!s.listedInDirectory || s.workplaces[0]?.organizationId == null) {
        continue;
      }
      out.push(
        mapSpecialistRowToListItem(
          s,
          locale,
          now,
          occupiedBySpecialist.get(id) ?? new Set(),
          doneBySpec.get(id) ?? 0,
          undefined,
          storefrontCategoryIdsByOrg,
        ),
      );
    }
    return out;
  }

  /**
   * Справочник для модалки фильтра каталога: подкатегории + диапазон VND в базе
   * для выбранного типа витрины (специалисты / салоны).
   */
  async getCatalogFilterOptions(
    locale: ApiLocale,
    tab: 'organizations' | 'specialists',
  ): Promise<CatalogFilterOptionsResponseDto> {
    // Для UX фильтров показываем полный справочник активных категорий текущей вертикали,
    // даже если по части категорий пока нет карточек в выдаче.
    const rows =
      await this.directoryRepository.findServiceCategoriesByMajorSlug(
        'massage',
      );
    const tags: DirectoryCategoryTagDto[] = rows
      .map((cat) => {
        const t = pickLocalizedServiceCategoryFields(cat, locale);
        return { slug: t.slug, shortName: t.shortName };
      })
      .sort((a, b) =>
        a.shortName.localeCompare(b.shortName, locale, { sensitivity: 'base' }),
      );

    const bodyZoneRows =
      await this.directoryRepository.findBodyZonesByMajorSlug('massage');
    const bodyZones: DirectoryBodyZoneTagDto[] = bodyZoneRows
      .map((z) => ({
        slug: z.slug,
        name: resolveLocalizedString(locale, z.locales, (l) => l.name, z.slug),
      }))
      .sort((a, b) =>
        a.name.localeCompare(b.name, locale, { sensitivity: 'base' }),
      );

    const priceRows =
      tab === 'specialists'
        ? await this.directoryRepository.aggregateVndPriceBoundsForListingSpecialists()
        : await this.directoryRepository.aggregateVndPriceBoundsForOrgListingServices();

    const MIN_SPAN = 50_000;
    let priceRangeVnd: CatalogFilterOptionsResponseDto['priceRangeVnd'] = null;
    if (
      priceRows.min != null &&
      priceRows.max != null &&
      Number.isFinite(priceRows.min) &&
      Number.isFinite(priceRows.max)
    ) {
      const { min, max } = priceRows;
      if (min === max) {
        priceRangeVnd = { min, max: min + MIN_SPAN };
      } else if (min < max) {
        priceRangeVnd = { min, max };
      }
    }

    return {
      categories: tags,
      bodyZones,
      genders: ['male', 'female'],
      priceRangeVnd,
    };
  }

  /**
   * Отзывы о салоне (`OrganizationReview`) — отдельно от отзывов о мастерах.
   */
  async listOrganizationReviews(
    _locale: ApiLocale,
    organizationId: string,
    options: { cursor: string | null; limit: number },
    viewerUserId?: string | null,
  ): Promise<DirectoryReviewsListResponseDto | null> {
    const can =
      await this.directoryRepository.canViewerAccessOrganizationReviews(
        organizationId,
        viewerUserId ?? null,
      );
    if (!can) {
      return null;
    }
    const rawCursor = options.cursor?.trim() || null;
    const decoded =
      rawCursor == null ? null : decodeReviewListCursor(rawCursor, 'orv');
    if (rawCursor != null && decoded == null) {
      throw new BadRequestException({
        code: 'INVALID_CURSOR',
        message: 'Invalid cursor',
      });
    }
    const limit = options.limit;
    const rows = await this.directoryRepository.findOrganizationReviewsPage({
      organizationId,
      limit: limit + 1,
      cursor: decoded,
      viewerUserId: viewerUserId ?? null,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last != null
        ? encodeReviewListCursor('orv', last.createdAt, last.id)
        : null;
    return {
      items: page.map((r) => ({
        id: r.id,
        authorName: r.authorName,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt.toISOString(),
        ...(r.publicationModerationStatus !==
        PublicationModerationStatus.approved
          ? {
              publicationModerationStatus: r.publicationModerationStatus,
            }
          : {}),
      })),
      cursorPage: { nextCursor, hasMore },
    };
  }

  /**
   * Отзывы о специалисте (`SpecialistReview`) — отдельно от отзывов о салоне.
   */
  async listSpecialistReviews(
    _locale: ApiLocale,
    specialistId: string,
    options: { cursor: string | null; limit: number },
    viewerUserId?: string | null,
  ): Promise<DirectoryReviewsListResponseDto | null> {
    const can = await this.directoryRepository.canViewerAccessSpecialistReviews(
      specialistId,
      viewerUserId ?? null,
    );
    if (!can) {
      return null;
    }
    const rawCursor = options.cursor?.trim() || null;
    const decoded =
      rawCursor == null ? null : decodeReviewListCursor(rawCursor, 'srv');
    if (rawCursor != null && decoded == null) {
      throw new BadRequestException({
        code: 'INVALID_CURSOR',
        message: 'Invalid cursor',
      });
    }
    const limit = options.limit;
    const rows = await this.directoryRepository.findSpecialistReviewsPage({
      specialistId,
      limit: limit + 1,
      cursor: decoded,
      viewerUserId: viewerUserId ?? null,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last != null
        ? encodeReviewListCursor('srv', last.createdAt, last.id)
        : null;
    return {
      items: page.map((r) => ({
        id: r.id,
        authorName: r.authorName,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt.toISOString(),
        ...(r.publicationModerationStatus !==
        PublicationModerationStatus.approved
          ? {
              publicationModerationStatus: r.publicationModerationStatus,
            }
          : {}),
      })),
      cursorPage: { nextCursor, hasMore },
    };
  }
}
