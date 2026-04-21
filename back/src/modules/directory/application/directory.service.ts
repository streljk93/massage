import { Injectable } from '@nestjs/common';
import type { ApiLocale } from '../../../common/i18n';
import {
  pickLocalizedOrganizationListItem,
  pickLocalizedServiceCategoryFields,
  type CategoryLocaleShape,
  type OrganizationLocaleListShape,
} from '../../../common/i18n';
import { buildListingSlotGroupsFromSlotStarts } from '../domain/build-card-slot-groups';
import {
  parseListingSlotGroups,
  type ListingSlotGroupSeed,
} from '../domain/listing-slot-groups';
import type { DirectoryCategoryTagDto } from '../dto/directory-category-tag.dto';
import type {
  OrganizationDetailResponseDto,
  OrganizationStaffMemberDto,
} from '../dto/organization-detail-response.dto';
import type { OrganizationListItemDto } from '../dto/organizations-list-response.dto';
import type { OrganizationsListResponseDto } from '../dto/organizations-list-response.dto';
import type { SpecialistListItemDto } from '../dto/specialists-list-response.dto';
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

function mergeOrganizationSlotStarts(org: OrganizationListRow): Date[] {
  const starts: Date[] = [];
  for (const e of org.specialistEmployments) {
    if (!e.specialist.listedInDirectory) {
      continue;
    }
    for (const sl of e.specialist.availabilitySlots) {
      starts.push(sl.startsAt);
    }
  }
  starts.sort((a, b) => a.getTime() - b.getTime());
  return starts;
}

function resolveSlotGroups(
  fromAvailability: ListingSlotGroupSeed[],
  jsonFallback: ListingSlotGroupSeed[],
): ListingSlotGroupSeed[] {
  return fromAvailability.length > 0 ? fromAvailability : jsonFallback;
}

function mapSpecialistRowToListItem(
  s: SpecialistListRow,
  locale: ApiLocale,
  now: Date,
): SpecialistListItemDto {
  const fromDb = buildListingSlotGroupsFromSlotStarts(
    s.availabilitySlots.map((x) => x.startsAt),
    now,
  );
  const fromJson = parseListingSlotGroups(s.listingSlotGroups);
  const slotGroups = resolveSlotGroups(fromDb, fromJson);

  const categoriesLine = joinLocalizedCategoryShortNames(
    s.serviceCategories,
    locale,
  );
  const metaLine =
    s.listingMetaLine?.trim() ||
    [s.addressLine, s.city].filter(Boolean).join(', ') ||
    s.bio?.trim() ||
    '';
  const servicesLine =
    s.listingServicesLine?.trim() ||
    categoriesLine ||
    s.specialtiesLine?.trim() ||
    '';
  return {
    id: s.id,
    userId: s.userId,
    name: s.user.name,
    bio: s.bio,
    specialtiesLine: s.specialtiesLine,
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
  };
}

function mapOrganizationRowToListItem(
  o: OrganizationListRow,
  locale: ApiLocale,
  now: Date,
): OrganizationListItemDto {
  const localized = pickLocalizedOrganizationListItem(
    o as unknown as OrganizationLocaleListShape,
    locale,
  );
  const fromDb = buildListingSlotGroupsFromSlotStarts(
    mergeOrganizationSlotStarts(o),
    now,
  );
  const fromJson = parseListingSlotGroups(o.listingSlotGroups);
  const slotGroups = resolveSlotGroups(fromDb, fromJson);

  const categoriesLine = joinLocalizedCategoryShortNames(
    o.serviceCategories,
    locale,
  );
  const metaLine = o.listingMetaLine?.trim() || localized.city?.trim() || '';
  const servicesLine =
    o.listingServicesLine?.trim() ||
    categoriesLine ||
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
    specialtiesLine: s.specialtiesLine,
    imageUrl: s.imageUrl,
  };
}

@Injectable()
export class DirectoryService {
  constructor(private readonly directoryRepository: DirectoryRepository) {}

  async listSpecialists(
    locale: ApiLocale,
  ): Promise<SpecialistsListResponseDto> {
    const now = new Date();
    const rows = await this.directoryRepository.findAllSpecialists(now);
    return {
      specialists: rows.map((s) => mapSpecialistRowToListItem(s, locale, now)),
    };
  }

  async listOrganizations(
    locale: ApiLocale,
  ): Promise<OrganizationsListResponseDto> {
    const now = new Date();
    const rows = await this.directoryRepository.findAllOrganizations(now);
    return {
      organizations: rows.map((o) =>
        mapOrganizationRowToListItem(o, locale, now),
      ),
    };
  }

  async getSpecialistById(
    locale: ApiLocale,
    id: string,
  ): Promise<SpecialistListItemDto | null> {
    const now = new Date();
    const row = await this.directoryRepository.findSpecialistById(id, now);
    if (!row) {
      return null;
    }
    return mapSpecialistRowToListItem(row, locale, now);
  }

  async getOrganizationById(
    locale: ApiLocale,
    id: string,
  ): Promise<OrganizationDetailResponseDto | null> {
    const now = new Date();
    const row = await this.directoryRepository.findOrganizationById(id, now);
    if (!row) {
      return null;
    }
    const base = mapOrganizationRowToListItem(row, locale, now);
    // Только мастера, доступные для записи (как в каталоге). Владелец «без приёма»
    // (listedInDirectory: false) остаётся в employment, но не показывается в блоке сотрудников.
    const staff: OrganizationStaffMemberDto[] = row.specialistEmployments
      .filter((e) => e.isActive && e.specialist.listedInDirectory)
      .map((e) => mapSpecialistToStaffMember(e.specialist));
    return {
      ...base,
      staff,
    };
  }
}
