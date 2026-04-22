import { Injectable } from '@nestjs/common';
import type { ApiLocale } from '../../../common/i18n';
import {
  pickLocalizedOrganizationListItem,
  pickLocalizedServiceCategoryFields,
  pickLocalizedServiceName,
  type CategoryLocaleShape,
  type OrganizationLocaleListShape,
} from '../../../common/i18n';
import { buildListingSlotGroupsFromSlotStarts } from '../domain/build-card-slot-groups';
import { filterSlotGroupsByOccupiedKeys } from '../domain/filter-slot-groups-by-occupied';
import {
  dropPastListingSlotGroups,
  parseListingSlotGroups,
  type ListingSlotGroupSeed,
} from '../domain/listing-slot-groups';
import {
  computeFreeSlotStartsForSpecialist,
  mergeBookingsToOccupiedKeysPerSpecialist,
} from '../domain/workday-free-slots';
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
  OrganizationListRow,
  SpecialistListRow,
} from '../infrastructure/directory.repository';
import { DirectoryRepository } from '../infrastructure/directory.repository';

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

function unionOccupiedKeysForOrganization(
  o: OrganizationListRow,
  occupiedMap: Map<string, Set<string>>,
): Set<string> {
  const union = new Set<string>();
  for (const e of o.specialistEmployments) {
    if (!e.specialist.listedInDirectory) {
      continue;
    }
    for (const k of occupiedMap.get(e.specialist.id) ?? []) {
      union.add(k);
    }
  }
  return union;
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
    out.push({
      id: svc.id,
      name,
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
  const fromDb = buildListingSlotGroupsFromSlotStarts(freeSlotStarts, now);
  const fromJson = parseListingSlotGroups(s.listingSlotGroups);
  const slotGroupsRaw = resolveSlotGroups(fromDb, fromJson);
  const slotGroups = dropPastListingSlotGroups(
    filterSlotGroupsByOccupiedKeys(slotGroupsRaw, occupiedKeys),
    now,
  );

  const categoriesLine = joinLocalizedCategoryShortNames(
    s.serviceCategories,
    locale,
  );
  const metaLine =
    s.listingMetaLine?.trim() ||
    [s.addressLine, s.city].filter(Boolean).join(', ') ||
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
    latitude: s.latitude,
    longitude: s.longitude,
    addressLine: s.addressLine,
    city: s.city,
    imageUrl: s.imageUrl,
    imageAlt: s.imageAlt,
    metaLine,
    servicesLine,
    categories: mapDirectoryCategoryTags(s.serviceCategories, locale),
    slotGroups,
    bookableServices: mapSpecialistOwnBookableServices(s.services, locale),
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
    now,
  );
  const fromJson = parseListingSlotGroups(o.listingSlotGroups);
  const slotGroupsRaw = resolveSlotGroups(fromDb, fromJson);
  const unionKeys = unionOccupiedKeysForOrganization(o, occupiedMap);
  const slotGroups = dropPastListingSlotGroups(
    filterSlotGroupsByOccupiedKeys(slotGroupsRaw, unionKeys),
    now,
  );

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
): OrganizationStaffMemberDto {
  const metaLine =
    s.listingMetaLine?.trim() ||
    [s.addressLine, s.city].filter(Boolean).join(', ') ||
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
  };
}

@Injectable()
export class DirectoryService {
  constructor(private readonly directoryRepository: DirectoryRepository) {}

  private async buildOccupiedAndFreeSlotMaps(
    specialistIds: string[],
    now: Date,
  ): Promise<{
    occupiedBySpecialist: Map<string, Set<string>>;
    freeBySpecialist: Map<string, Date[]>;
  }> {
    const bookingRows =
      await this.directoryRepository.findActiveBookingsForListingOccupancy(
        specialistIds,
        now,
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
        ),
      );
    }
    return { occupiedBySpecialist, freeBySpecialist };
  }

  async listSpecialists(
    locale: ApiLocale,
  ): Promise<SpecialistsListResponseDto> {
    const now = new Date();
    const rows = await this.directoryRepository.findAllSpecialists();
    const { occupiedBySpecialist, freeBySpecialist } =
      await this.buildOccupiedAndFreeSlotMaps(
        rows.map((s) => s.id),
        now,
      );
    return {
      specialists: rows.map((s) =>
        mapSpecialistRowToListItem(
          s,
          locale,
          now,
          occupiedBySpecialist.get(s.id) ?? new Set(),
          freeBySpecialist.get(s.id) ?? [],
        ),
      ),
    };
  }

  async listOrganizations(
    locale: ApiLocale,
  ): Promise<OrganizationsListResponseDto> {
    const now = new Date();
    const rows = await this.directoryRepository.findAllOrganizations();
    const specialistIds = new Set<string>();
    for (const o of rows) {
      for (const e of o.specialistEmployments) {
        if (e.isActive && e.specialist.listedInDirectory) {
          specialistIds.add(e.specialist.id);
        }
      }
    }
    const { occupiedBySpecialist, freeBySpecialist } =
      await this.buildOccupiedAndFreeSlotMaps([...specialistIds], now);
    return {
      organizations: rows.map((o) =>
        mapOrganizationRowToListItem(
          o,
          locale,
          now,
          occupiedBySpecialist,
          freeBySpecialist,
        ),
      ),
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
      await this.buildOccupiedAndFreeSlotMaps([id], now);
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
      await this.buildOccupiedAndFreeSlotMaps(specialistIds, now);
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
      .map((e) => mapSpecialistToStaffMember(e.specialist, locale));
    return {
      ...base,
      staff,
    };
  }
}
