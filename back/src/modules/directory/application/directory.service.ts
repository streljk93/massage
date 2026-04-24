import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { listingCardPreviewWindowMs } from '../../../common/availability/listing-slot-policy';
import {
  decodeOrganizationListCursor,
  decodeSpecialistListCursor,
  encodeOrganizationListCursor,
  encodeSpecialistListCursor,
} from '../../../common/pagination/directory-list-cursor-codec';
import type { ApiLocale } from '../../../common/i18n';
import {
  pickLocalizedOrganizationListItem,
  pickLocalizedServiceCategoryFields,
  pickLocalizedServiceName,
  type CategoryLocaleShape,
  type OrganizationLocaleListShape,
} from '../../../common/i18n';
import { buildListingSlotGroupsFromSlotStarts } from '../domain/build-card-slot-groups';
import {
  filterOrgSlotGroupsByOccupiedKeys,
  filterSlotGroupsByOccupiedKeys,
} from '../domain/filter-slot-groups-by-occupied';
import {
  dropPastListingSlotGroups,
  parseListingSlotGroups,
  type ListingSlotGroupSeed,
} from '../domain/listing-slot-groups';
import {
  computeFreeSlotStartsForSpecialist,
  mergeBookingsToOccupiedKeysPerSpecialist,
} from '../domain/workday-free-slots';
import type { CatalogFilterOptionsResponseDto } from '../dto/catalog-filter-options-response.dto';
import type { DirectoryCategoryTagDto } from '../dto/directory-category-tag.dto';
import type {
  OrganizationDetailResponseDto,
  OrganizationStaffMemberDto,
} from '../dto/organization-detail-response.dto';
import type { OrganizationListItemDto } from '../dto/organizations-list-response.dto';
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
import type {
  OrganizationListRow,
  SpecialistListRow,
} from '../infrastructure/directory.repository';
import { DirectoryRepository } from '../infrastructure/directory.repository';

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

function mapDirectoryCategoryTags(
  links: { serviceCategory: CategoryLocaleShape }[],
  locale: ApiLocale,
): DirectoryCategoryTagDto[] {
  return links.map((l) => {
    const c = pickLocalizedServiceCategoryFields(l.serviceCategory, locale);
    return { slug: c.slug, shortName: c.shortName };
  });
}

function mergeOrganizationFreeSlotStarts(
  org: OrganizationListRow,
  freeBySpec: Map<string, Date[]>,
): Date[] {
  const starts: Date[] = [];
  for (const e of org.specialistEmployments) {
    if (!e.specialist.listedInDirectory) {
      continue;
    }
    starts.push(...(freeBySpec.get(e.specialist.id) ?? []));
  }
  starts.sort((a, b) => a.getTime() - b.getTime());
  const seen = new Set<number>();
  const deduped: Date[] = [];
  for (const s of starts) {
    const t = s.getTime();
    if (!seen.has(t)) {
      seen.add(t);
      deduped.push(s);
    }
  }
  return deduped;
}

function resolveSlotGroups(
  fromAvailability: ListingSlotGroupSeed[],
  jsonFallback: ListingSlotGroupSeed[],
): ListingSlotGroupSeed[] {
  return fromAvailability.length > 0 ? fromAvailability : jsonFallback;
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
    const name = pickLocalizedServiceName(svc, locale);
    const categoryShortName = svc.category
      ? pickLocalizedServiceCategoryFields(svc.category, locale).shortName
      : '';
    out.push({
      id: svc.id,
      name,
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
  freeSlotStarts: Date[],
): SpecialistListItemDto {
  const fromDb = buildListingSlotGroupsFromSlotStarts(freeSlotStarts);
  const fromJson = parseListingSlotGroups(s.listingSlotGroups);
  const slotGroupsRaw = resolveSlotGroups(fromDb, fromJson);
  const slotGroups = dropPastListingSlotGroups(
    filterSlotGroupsByOccupiedKeys(slotGroupsRaw, occupiedKeys),
    now,
  );

  const loc = s.activeOrganization;
  const addressLine = loc?.addressLine ?? null;
  const city = loc?.city ?? null;
  const latitude = loc?.latitude ?? null;
  const longitude = loc?.longitude ?? null;

  const categoriesLine = joinLocalizedCategoryShortNames(
    s.serviceCategories,
    locale,
  );
  const metaLine =
    s.listingMetaLine?.trim() ||
    loc?.listingMetaLine?.trim() ||
    [addressLine, city].filter(Boolean).join(', ') ||
    s.bio?.trim() ||
    '';
  // `listingServicesLine` — денормализация (часто en из сида); для витрины важнее
  // локализованная склейка по M2M `serviceCategories`, если она есть.
  const servicesLine = categoriesLine || s.listingServicesLine?.trim() || '';
  return {
    id: s.id,
    userId: s.userId,
    name: s.user.name,
    bio: s.bio,
    experienceYears: s.experienceYears,
    ratingAverage: s.ratingAverage,
    rating: s.ratingAverage,
    reviewsCount: s.reviewsCount,
    latitude,
    longitude,
    addressLine,
    city,
    imageUrl: s.imageUrl,
    imageAlt: s.imageAlt,
    metaLine,
    servicesLine,
    categories: mapDirectoryCategoryTags(s.serviceCategories, locale),
    slotGroups,
    bookableServices: mapSpecialistOwnBookableServices(s.services, locale),
    autoConfirmBookings: s.autoConfirmBookings,
  };
}

function mapOrganizationRowToListItem(
  o: OrganizationListRow,
  locale: ApiLocale,
  now: Date,
  occupiedMap: Map<string, Set<string>>,
  freeBySpec: Map<string, Date[]>,
): OrganizationListItemDto {
  const localized = pickLocalizedOrganizationListItem(
    o as unknown as OrganizationLocaleListShape,
    locale,
  );
  const fromDb = buildListingSlotGroupsFromSlotStarts(
    mergeOrganizationFreeSlotStarts(o, freeBySpec),
  );
  const fromJson = parseListingSlotGroups(o.listingSlotGroups);
  const slotGroupsRaw = resolveSlotGroups(fromDb, fromJson);
  const listedSpecialistIds = o.specialistEmployments
    .filter((e) => e.specialist.listedInDirectory)
    .map((e) => e.specialist.id);
  /**
   * Слоты из доступности уже собраны как union свободных стартов по мастерам
   * (`mergeOrganizationFreeSlotStarts` + `computeFreeSlotStartsForSpecialist` с их бронями).
   * Повторная фильтрация по union занятых давала ложное скрытие слота при брони одного мастера.
   * Fallback JSON: оставляем время, если не занято хотя бы у одного мастера.
   */
  const slotGroupsBeforePast =
    fromDb.length > 0
      ? slotGroupsRaw
      : filterOrgSlotGroupsByOccupiedKeys(
          slotGroupsRaw,
          listedSpecialistIds,
          occupiedMap,
        );
  const slotGroups = dropPastListingSlotGroups(slotGroupsBeforePast, now);

  const categoriesLine = joinLocalizedCategoryShortNames(
    o.serviceCategories,
    locale,
  );
  const metaLine = o.listingMetaLine?.trim() || localized.city?.trim() || '';
  const servicesLine =
    categoriesLine ||
    o.listingServicesLine?.trim() ||
    localized.description?.trim() ||
    '';
  return {
    id: localized.id,
    slug: o.slug,
    name: localized.name,
    description: localized.description,
    city: localized.city,
    addressLine: o.addressLine,
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
    categories: mapDirectoryCategoryTags(o.serviceCategories, locale),
    slotGroups,
  };
}

function mapSpecialistToStaffMember(
  s: OrganizationListRow['specialistEmployments'][number]['specialist'],
  locale: ApiLocale,
  /** Строка локации салона (карточка сотрудника привязана к этой организации). */
  organizationMetaLine: string,
  occupiedKeys: Set<string>,
): OrganizationStaffMemberDto {
  const metaLine =
    organizationMetaLine.trim() ||
    s.listingMetaLine?.trim() ||
    s.bio?.trim() ||
    '';
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
    private readonly directoryRepository: DirectoryRepository,
    private readonly config: ConfigService,
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
   * Одно окно для расчёта свободных слотов в списках и на профиле.
   * Иначе карточка (узкое `listingCardPreview`) и страница (`profileSlotPreview`) расходятся,
   * а deep link `?slotDay=&slotTime=` с витрины не находит время в сетке профиля.
   */
  private getUnifiedDirectorySlotPreviewCalendarDays(): number {
    return Math.max(
      this.getListingCardPreviewCalendarDays(),
      this.getProfileSlotPreviewCalendarDays(),
    );
  }

  private async buildOccupiedAndFreeSlotMaps(
    specialistIds: string[],
    now: Date,
    calendarDays: number,
  ): Promise<{
    occupiedBySpecialist: Map<string, Set<string>>;
    freeBySpecialist: Map<string, Date[]>;
  }> {
    const previewWindowMs = listingCardPreviewWindowMs(calendarDays);
    const bookingRows =
      await this.directoryRepository.findActiveBookingsForListingOccupancy(
        specialistIds,
        now,
        previewWindowMs,
      );
    const occupiedBySpecialist =
      mergeBookingsToOccupiedKeysPerSpecialist(bookingRows);
    const freeBySpecialist = new Map<string, Date[]>();
    for (const id of specialistIds) {
      freeBySpecialist.set(
        id,
        computeFreeSlotStartsForSpecialist(
          now,
          occupiedBySpecialist.get(id) ?? new Set(),
          calendarDays,
        ),
      );
    }
    return { occupiedBySpecialist, freeBySpecialist };
  }

  async listSpecialists(
    locale: ApiLocale,
    options: {
      limit: number;
      cursor: string | null;
      majorCategorySlug: string | null;
      q: string | null;
      categorySlugs: string[];
      priceMinVnd: number | null;
      priceMaxVnd: number | null;
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
    const limit = options.limit;
    const filters = specialistListFiltersOrNull(
      locale,
      options.majorCategorySlug,
      options.q,
      options.categorySlugs,
      options.priceMinVnd,
      options.priceMaxVnd,
    );
    const rows = await this.directoryRepository.findSpecialistsPage({
      take: limit + 1,
      cursor: decoded,
      filters,
    });
    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    const { occupiedBySpecialist, freeBySpecialist } =
      await this.buildOccupiedAndFreeSlotMaps(
        slice.map((s) => s.id),
        now,
        this.getUnifiedDirectorySlotPreviewCalendarDays(),
      );
    const last = slice[slice.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeSpecialistListCursor(last.user.name, last.id)
        : null;
    return {
      specialists: slice.map((s) =>
        mapSpecialistRowToListItem(
          s,
          locale,
          now,
          occupiedBySpecialist.get(s.id) ?? new Set(),
          freeBySpecialist.get(s.id) ?? [],
        ),
      ),
      cursorPage: { nextCursor, hasMore },
    };
  }

  async listOrganizations(
    locale: ApiLocale,
    options: {
      limit: number;
      cursor: string | null;
      majorCategorySlug: string | null;
      q: string | null;
      categorySlugs: string[];
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
    const limit = options.limit;
    const filters = organizationListFiltersOrNull(
      locale,
      options.majorCategorySlug,
      options.q,
      options.categorySlugs,
    );
    const rows = await this.directoryRepository.findOrganizationsPage({
      take: limit + 1,
      cursor: decoded,
      filters,
    });
    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    const specialistIds = new Set<string>();
    for (const o of slice) {
      for (const e of o.specialistEmployments) {
        if (e.isActive && e.specialist.listedInDirectory) {
          specialistIds.add(e.specialist.id);
        }
      }
    }
    const { occupiedBySpecialist, freeBySpecialist } =
      await this.buildOccupiedAndFreeSlotMaps(
        [...specialistIds],
        now,
        this.getUnifiedDirectorySlotPreviewCalendarDays(),
      );
    const last = slice[slice.length - 1];
    const nextCursor =
      hasMore && last ? encodeOrganizationListCursor(last.name, last.id) : null;
    return {
      organizations: slice.map((o) =>
        mapOrganizationRowToListItem(
          o,
          locale,
          now,
          occupiedBySpecialist,
          freeBySpecialist,
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
    const row = await this.directoryRepository.findSpecialistById(id);
    if (!row) {
      return null;
    }
    const { occupiedBySpecialist, freeBySpecialist } =
      await this.buildOccupiedAndFreeSlotMaps(
        [id],
        now,
        this.getUnifiedDirectorySlotPreviewCalendarDays(),
      );
    return mapSpecialistRowToListItem(
      row,
      locale,
      now,
      occupiedBySpecialist.get(id) ?? new Set(),
      freeBySpecialist.get(id) ?? [],
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
      .filter((e) => e.isActive && e.specialist.listedInDirectory)
      .map((e) => e.specialist.id);
    const { occupiedBySpecialist, freeBySpecialist } =
      await this.buildOccupiedAndFreeSlotMaps(
        specialistIds,
        now,
        this.getUnifiedDirectorySlotPreviewCalendarDays(),
      );
    const base = mapOrganizationRowToListItem(
      row,
      locale,
      now,
      occupiedBySpecialist,
      freeBySpecialist,
    );
    // Только мастера, доступные для записи (как в каталоге). Владелец «без приёма»
    // (listedInDirectory: false) остаётся в employment, но не показывается в блоке сотрудников.
    const staff: OrganizationStaffMemberDto[] = row.specialistEmployments
      .filter((e) => e.isActive && e.specialist.listedInDirectory)
      .map((e) =>
        mapSpecialistToStaffMember(
          e.specialist,
          locale,
          base.metaLine,
          occupiedBySpecialist.get(e.specialist.id) ?? new Set(),
        ),
      );
    return {
      ...base,
      staff,
    };
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
}
