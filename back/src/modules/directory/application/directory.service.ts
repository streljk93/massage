import {
  BadRequestException,
  Inject,
  Injectable,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DirectoryRepository,
  type DirectoryListRadiusFilter,
  type OrganizationListRow,
  type SpecialistListRow,
} from '../infrastructure/directory.repository';
import { normalizeDirectoryListingWorkdayBounds } from '../../../common/availability/directory-listing-workday';
import { listingCardPreviewWindowMs } from '../../../common/availability/listing-slot-policy';
import {
  decodeOrganizationListCursor,
  decodeSpecialistListCursor,
  encodeOrganizationListCursor,
  encodeSpecialistListCursor,
} from '../../../common/pagination/directory-list-cursor-codec';
import type { DirectoryListSort } from '../../../common/pagination/directory-list-sort';
import { PersonalizationService } from '../../personalization/application/personalization.service';
import {
  decodeReviewListCursor,
  encodeReviewListCursor,
} from '../../../common/pagination/review-list-cursor-codec';
import type { ApiLocale } from '../../../common/i18n';
import {
  pickLocalizedOrganizationListItem,
  pickLocalizedServiceCategoryFields,
  type CategoryLocaleShape,
  type OrganizationLocaleListShape,
} from '../../../common/i18n';
import { buildListingSlotGroupsFromOccupiedKeys } from '../domain/build-occupied-listing-slot-groups';
import { mergeBookingsToOccupiedKeysPerSpecialist } from '../domain/workday-free-slots';
import type { CatalogFilterOptionsResponseDto } from '../dto/catalog-filter-options-response.dto';
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
  priceMinVnd: number | null,
  priceMaxVnd: number | null,
): SpecialistListApiFilters | null {
  const hasMajor = majorCategorySlug != null && majorCategorySlug !== '';
  const has =
    hasMajor ||
    (q != null && q !== '') ||
    categorySlugs.length > 0 ||
    priceMinVnd != null ||
    priceMaxVnd != null;
  if (!has) {
    return null;
  }
  return {
    majorCategorySlug: hasMajor ? majorCategorySlug : null,
    q,
    categorySlugs,
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
): OrganizationListApiFilters | null {
  const hasMajor = majorCategorySlug != null && majorCategorySlug !== '';
  const has = hasMajor || (q != null && q !== '') || categorySlugs.length > 0;
  if (!has) {
    return null;
  }
  return {
    majorCategorySlug: hasMajor ? majorCategorySlug : null,
    q,
    categorySlugs,
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
  return (
    e.isActive &&
    e.specialist.listedInDirectory &&
    e.specialist.activeOrganizationId === organizationId
  );
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

type DirectoryServiceRow = SpecialistListRow['services'][number];

function isVndPriceOption(p: { currency: string }): boolean {
  return (p.currency ?? 'VND').toUpperCase() === 'VND';
}

/** Услуги из `Service` + `ServicePriceOption` (только VND). */
function mapServiceRowsToBookable(
  services: DirectoryServiceRow[],
  locale: ApiLocale,
): SpecialistBookableServiceDto[] {
  const out: SpecialistBookableServiceDto[] = [];
  for (const svc of services) {
    const vndOpts = (svc.priceOptions ?? []).filter(isVndPriceOption);
    if (vndOpts.length === 0) {
      continue;
    }
    const categoryShortName = svc.category
      ? pickLocalizedServiceCategoryFields(svc.category, locale).shortName
      : '';
    out.push({
      id: svc.id,
      categoryShortName,
      durationMinutes: vndOpts.map((p) => p.durationMinutes),
      priceVndByDuration: vndOpts.map((p) => p.priceAmount),
    });
  }
  return out;
}

/** Только `Service` с `specialistId` = этот мастер (см. `Specialist.services`). */
function mapSpecialistOwnBookableServices(
  services: SpecialistListRow['services'],
  locale: ApiLocale,
): SpecialistBookableServiceDto[] {
  return mapServiceRowsToBookable(services, locale);
}

function mapSpecialistRowToListItem(
  s: SpecialistListRow,
  locale: ApiLocale,
  now: Date,
  occupiedKeys: Set<string>,
  doneClientsCount: number,
): SpecialistListItemDto {
  const slotGroups = buildListingSlotGroupsFromOccupiedKeys(occupiedKeys, now);

  const loc = s.activeOrganization;
  const addr = loc?.address;
  const addressLine = addr?.addressLine ?? null;
  const city = addr?.city ?? null;
  const latitude = addr?.latitude ?? null;
  const longitude = addr?.longitude ?? null;

  const categoriesLine = joinLocalizedCategoryShortNames(
    s.serviceCategories,
    locale,
  );
  const metaLine =
    [addressLine, city].filter((x) => x?.trim()).join(', ') ||
    s.bio?.trim() ||
    '';
  const servicesLine = categoriesLine || '';
  const listingWd = normalizeDirectoryListingWorkdayBounds(
    loc?.listingWorkdayStartMinute,
    loc?.listingWorkdayEndMinute,
  );
  const phone = loc?.phone?.trim() || s.user.phone?.trim() || null;
  const activeWorkplace = loc ? { id: loc.id, name: loc.name.trim() } : null;
  return {
    id: s.id,
    userId: s.userId,
    name: s.user.name,
    bio: s.bio,
    experienceYears: s.experienceYears,
    doneClientsCount,
    ratingAverage: s.ratingAverage,
    rating: s.ratingAverage,
    reviewsCount: s.reviewsCount,
    latitude,
    longitude,
    addressLine,
    city,
    phone,
    imageUrl: s.imageUrl,
    imageAlt: s.imageAlt,
    metaLine,
    servicesLine,
    categories: mapDirectoryCategoryTags(s.serviceCategories, locale),
    slotGroups,
    bookableServices: mapSpecialistOwnBookableServices(s.services, locale),
    autoConfirmBookings: s.autoConfirmBookings,
    listingWorkdayStartMinute: listingWd.startMinute,
    listingWorkdayEndMinute: listingWd.endMinute,
    activeWorkplace,
  };
}

function mapOrganizationRowToListItem(
  o: OrganizationListRow,
  locale: ApiLocale,
  _now: Date,
  occupiedMap: Map<string, Set<string>>,
  storefront: { imageUrl: string | null; imageAlt: string | null },
  /** Подмножество OSC с покрытием мастером — только они на витрине. */
  storefrontCategoryIds: Set<string>,
): OrganizationListItemDto {
  const localized = pickLocalizedOrganizationListItem(
    {
      ...(o as unknown as OrganizationLocaleListShape),
      imageUrl: storefront.imageUrl,
      imageAlt: storefront.imageAlt,
    },
    locale,
  );
  const specialistOccupiedSlotKeys: SpecialistOccupiedSlotKeysEntryDto[] =
    o.specialistEmployments
      .filter((e) => isVitrineStaffAtOrganization(e, o.id))
      .map((e) => e.specialist.id)
      .map((specialistId) => ({
        specialistId,
        keys: [...(occupiedMap.get(specialistId) ?? new Set())].sort((a, b) =>
          a.localeCompare(b),
        ),
      }));

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
    name: localized.name,
    description: localized.description,
    city: localized.city,
    addressLine: o.address?.addressLine ?? null,
    phone: o.phone,
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
    slotGroups: [],
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
): OrganizationStaffMemberDto {
  const metaLine = organizationMetaLine.trim() || s.bio?.trim() || '';
  return {
    id: s.id,
    userId: s.userId,
    name: s.user.name,
    rating: s.ratingAverage,
    metaLine,
    imageUrl: s.imageUrl,
    bookableServices: mapSpecialistOwnBookableServices(s.services, locale),
    occupiedListingSlotKeys: [...occupiedKeys].sort(),
  };
}

@Injectable()
export class DirectoryService {
  constructor(
    @Inject(forwardRef(() => DirectoryRepository))
    private readonly directoryRepository: DirectoryRepository,
    @Inject(ConfigService)
    private readonly config: ConfigService,
    @Inject(forwardRef(() => PersonalizationService))
    private readonly personalizationService: PersonalizationService,
  ) {}

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
    const bookingRows =
      await this.directoryRepository.findActiveBookingsForListingOccupancy(
        specialistIds,
        now,
        previewWindowMs,
      );
    return mergeBookingsToOccupiedKeysPerSpecialist(bookingRows);
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
    const rawCursor = options.cursor?.trim() || null;
    const decoded =
      rawCursor == null ? null : decodeSpecialistListCursor(rawCursor);
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
      listPriceMin,
      listPriceMax,
    );
    const rows = await this.directoryRepository.findSpecialistsPage({
      take: limit + 1,
      sort: options.sort,
      cursor: decoded,
      filters,
      radius: options.radius,
      overlapCategorySlugs,
    });
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
            decoded,
            last,
          )
        : null;
    const doneClientsBySpec =
      await this.directoryRepository.countDistinctDoneClientsBySpecialistIds(
        slice.map((s) => s.id),
      );
    return {
      specialists: slice.map((s) =>
        mapSpecialistRowToListItem(
          s,
          locale,
          now,
          occupiedBySpecialist.get(s.id) ?? new Set(),
          doneClientsBySpec.get(s.id) ?? 0,
        ),
      ),
      cursorPage: { nextCursor, hasMore },
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
    );
    const rows = await this.directoryRepository.findOrganizationsPage({
      take: limit + 1,
      sort: options.sort,
      cursor: decoded,
      filters,
      radius: options.radius,
      overlapCategorySlugs,
    });
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
          storefrontByOrg.get(o.id) ?? {
            imageUrl: null,
            imageAlt: null,
          },
          storefrontCategoriesByOrg.get(o.id) ?? new Set<string>(),
        ),
      ),
      cursorPage: { nextCursor, hasMore },
    };
  }

  async getSpecialistById(
    locale: ApiLocale,
    id: string,
  ): Promise<SpecialistListItemDto | null> {
    const now = new Date();
    const row =
      await this.directoryRepository.findPublicDirectorySpecialistById(id);
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
    return mapSpecialistRowToListItem(
      row,
      locale,
      now,
      occupiedBySpecialist.get(id) ?? new Set(),
      doneBySpec.get(id) ?? 0,
    );
  }

  async getOrganizationById(
    locale: ApiLocale,
    id: string,
  ): Promise<OrganizationDetailResponseDto | null> {
    const now = new Date();
    const row = await this.directoryRepository.findOrganizationById(id);
    if (!row) {
      return null;
    }
    const specialistIds = row.specialistEmployments
      .filter((e) => isVitrineStaffAtOrganization(e, row.id))
      .map((e) => e.specialist.id);
    const occupiedBySpecialist = await this.buildOccupiedBySpecialistMap(
      specialistIds,
      now,
      this.getUnifiedDirectorySlotPreviewCalendarDays(),
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
      storefront,
      storefrontCategoriesByOrg.get(id) ?? new Set<string>(),
    );
    // Только мастера, доступные для записи (как в каталоге). Владелец «без приёма»
    // (listedInDirectory: false) остаётся в employment, но не показывается в блоке сотрудников.
    const staff: OrganizationStaffMemberDto[] = row.specialistEmployments
      .filter((e) => isVitrineStaffAtOrganization(e, row.id))
      .map((e) =>
        mapSpecialistToStaffMember(
          e.specialist,
          locale,
          base.metaLine,
          occupiedBySpecialist.get(e.specialist.id) ?? new Set(),
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
    return {
      ...base,
      staff,
      clientsCount,
      vitrineGalleryItems,
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
    const out: SpecialistListItemDto[] = [];
    for (const id of ids) {
      const s = byId.get(id);
      if (!s) {
        continue;
      }
      if (!s.listedInDirectory || s.activeOrganizationId == null) {
        continue;
      }
      out.push(
        mapSpecialistRowToListItem(
          s,
          locale,
          now,
          occupiedBySpecialist.get(id) ?? new Set(),
          doneBySpec.get(id) ?? 0,
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
    const categoryIds =
      tab === 'specialists'
        ? await this.directoryRepository.findDistinctServiceCategoryIdsForListingSpecialists()
        : await this.directoryRepository.findDistinctServiceCategoryIdsForListingOrganizations();

    const rows =
      await this.directoryRepository.findServiceCategoriesByIds(categoryIds);
    const tags: DirectoryCategoryTagDto[] = rows
      .map((cat) => {
        const t = pickLocalizedServiceCategoryFields(cat, locale);
        return { slug: t.slug, shortName: t.shortName };
      })
      .sort((a, b) =>
        a.shortName.localeCompare(b.shortName, locale, { sensitivity: 'base' }),
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

    return { categories: tags, priceRangeVnd };
  }

  /**
   * Отзывы о салоне (`OrganizationReview`) — отдельно от отзывов о мастерах.
   */
  async listOrganizationReviews(
    _locale: ApiLocale,
    organizationId: string,
    options: { cursor: string | null; limit: number },
  ): Promise<DirectoryReviewsListResponseDto | null> {
    const org =
      await this.directoryRepository.findActiveOrganizationId(organizationId);
    if (!org) {
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
  ): Promise<DirectoryReviewsListResponseDto | null> {
    const spec =
      await this.directoryRepository.findActiveSpecialistId(specialistId);
    if (!spec) {
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
      })),
      cursorPage: { nextCursor, hasMore },
    };
  }
}
