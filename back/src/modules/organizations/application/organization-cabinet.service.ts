import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ContentModerationCaseKind,
  ContentModerationCaseStatus,
  GalleryMediaKind,
  GalleryOwnerKind,
  OrganizationMembershipRole,
  OrganizationProfileRevisionStatus,
  PublicationModerationStatus,
  SpecialistWorkplaceJoinRequestStatus,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { ApiLocale } from '../../../common/i18n';
import {
  buildBookingStatusLabelMap,
  parseApiLocale,
  pickBookingStatusLabel,
  pickLocalizedOrganizationListItem,
} from '../../../common/i18n';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { BOOKING_CANCEL_REASON_ORGANIZATION_DELETED_EN } from '../../bookings/domain/booking-cancel-reason';
import { BookingStatusLocaleRepository } from '../../bookings/infrastructure/booking-status-locale.repository';
import { BookingsRepository } from '../../bookings/infrastructure/bookings.repository';
import { organizationNonCategoryTextSearchWhere } from '../../directory/infrastructure/directory-list-query-filters';
import { AddressPersistenceService } from '../../address/application/address-persistence.service';
import { AddressResolutionService } from '../../address/application/address-resolution.service';
import { GalleryService } from '../../gallery/application/gallery.service';
import { ModerationEnqueueService } from '../../moderation/application/moderation-enqueue.service';
import { PushNotificationsService } from '../../notifications/application/push-notifications.service';
import { SpecialistOnboardingService } from '../../specialists/application/specialist-onboarding.service';
import { computeListedInDirectory } from '../../specialists/domain/specialist-directory-flags';
import type { CreateOrganizationBody } from '../dto/create-organization-body.schema';
import type { WorkplaceOrganizationSearchResponseDto } from '../dto/workplace-organization-search.dto';
import type {
  WorkplaceJoinRequestListQuery,
  WorkplaceJoinRequestReviewBody,
} from '../dto/workplace-join-request.schema';

const CABINET_ALLOWED_PLACE_PROVIDERS = new Set<
  'locationiq' | 'geoapify' | 'opencage' | 'nominatim'
>(['locationiq', 'geoapify', 'opencage', 'nominatim']);

export type OrganizationCabinetEditProfileDto = {
  primaryMajorCategorySlug: string;
  additionalMajorCategorySlugs: string[];
  name: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  yearsInBusiness: number | null;
  addressLine: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  placeReference: {
    provider: 'locationiq' | 'geoapify' | 'opencage' | 'nominatim';
    placeId: string;
  } | null;
  serviceCategoryIds: string[];
  galleryItems: Array<{ url: string; alt: string | null }>;
};

@Injectable()
export class OrganizationCabinetService {
  private readonly logger = new Logger(OrganizationCabinetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly addressResolution: AddressResolutionService,
    private readonly addressPersistence: AddressPersistenceService,
    private readonly gallery: GalleryService,
    private readonly specialistOnboarding: SpecialistOnboardingService,
    private readonly moderationEnqueue: ModerationEnqueueService,
    private readonly bookingsRepository: BookingsRepository,
    private readonly bookingStatusLocaleRepository: BookingStatusLocaleRepository,
    private readonly pushNotifications: PushNotificationsService,
  ) {}

  private async syncSpecialistListedInDirectory(
    tx: Prisma.TransactionClient,
    specialistId: string,
  ): Promise<void> {
    const fresh = await tx.specialist.findFirst({
      where: { id: specialistId },
      select: { onboardingCompletedAt: true, activeOrganizationId: true },
    });
    if (fresh) {
      await tx.specialist.update({
        where: { id: specialistId },
        data: {
          listedInDirectory: computeListedInDirectory({
            onboardingCompletedAt: fresh.onboardingCompletedAt,
            activeOrganizationId: fresh.activeOrganizationId,
          }),
        },
      });
    }
  }

  private async grantSpecialistMembershipAtOrganization(
    tx: Prisma.TransactionClient,
    specialistId: string,
    organizationId: string,
  ): Promise<void> {
    const startDate = new Date();
    const existing = await tx.specialistOrganizationEmployment.findFirst({
      where: { specialistId, organizationId },
    });
    if (existing) {
      await tx.specialistOrganizationEmployment.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          endDate: null,
          startDate,
          role: OrganizationMembershipRole.specialist,
        },
      });
    } else {
      await tx.specialistOrganizationEmployment.create({
        data: {
          specialistId,
          organizationId,
          role: OrganizationMembershipRole.specialist,
          startDate,
          isActive: true,
        },
      });
    }
    await tx.specialist.update({
      where: { id: specialistId },
      data: { activeOrganizationId: organizationId },
    });
    await this.syncSpecialistListedInDirectory(tx, specialistId);
  }

  private async resolveCabinetBookingPreviewLocaleOrg(
    userId: string,
    localeFromQuery: ApiLocale | undefined,
  ): Promise<ApiLocale> {
    if (localeFromQuery !== undefined) {
      return localeFromQuery;
    }
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { locale: true },
    });
    return parseApiLocale(user?.locale);
  }

  private async assertUserIsOrganizationOwner(
    userId: string,
    organizationId: string,
  ): Promise<void> {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { id: true, ownerUserId: true },
    });
    if (!org) {
      throw new NotFoundException({
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Organization not found',
      });
    }
    if (org.ownerUserId !== userId) {
      throw new ForbiddenException({
        code: 'NOT_ORGANIZATION_OWNER',
        message: 'Only the organization owner can delete the salon',
      });
    }
  }

  async previewDeleteOrganizationBookings(
    userId: string,
    organizationId: string,
    localeFromQuery: ApiLocale | undefined,
  ): Promise<{
    bookings: Array<{
      id: string;
      status: string;
      statusLabel: string;
      startsAt: string;
      endsAt: string;
      pendingExpiresAt: string | null;
      clientDisplayName: string;
      categoryShortName: string;
      durationMinutes: number;
      specialistDisplayName: string;
    }>;
  }> {
    await this.assertUserIsOrganizationOwner(userId, organizationId);
    const locale = await this.resolveCabinetBookingPreviewLocaleOrg(
      userId,
      localeFromQuery,
    );
    const [localeRows, rawRows] = await Promise.all([
      this.bookingStatusLocaleRepository.findAll(),
      this.bookingsRepository.findAllActiveBookingsAtOrganizationForDeletePreview(
        organizationId,
      ),
    ]);
    const labelMap = buildBookingStatusLabelMap(localeRows);
    return {
      bookings: rawRows.map((b) => ({
        id: b.id,
        status: b.status,
        statusLabel: pickBookingStatusLabel(b.status, locale, labelMap),
        startsAt: b.startsAt.toISOString(),
        endsAt: b.endsAt.toISOString(),
        pendingExpiresAt: b.pendingExpiresAt?.toISOString() ?? null,
        clientDisplayName: (() => {
          const n = b.clientDisplayName?.trim();
          return n != null && n.length > 0 ? n : '—';
        })(),
        categoryShortName: (() => {
          const c = (b.categoryShortNameSnapshot ?? '').trim();
          return c.length > 0 ? c : '—';
        })(),
        durationMinutes: b.durationMinutes,
        specialistDisplayName: (() => {
          const n = b.specialistDisplayName?.trim();
          return n != null && n.length > 0 ? n : '—';
        })(),
      })),
    };
  }

  async deleteOrganizationAsOwner(
    userId: string,
    organizationId: string,
  ): Promise<{ ok: true; cancelledBookingsCount: number }> {
    await this.assertUserIsOrganizationOwner(userId, organizationId);
    const now = new Date();
    const cancelled = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.findFirst({
        where: { id: organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!org) {
        throw new NotFoundException({
          code: 'ORGANIZATION_NOT_FOUND',
          message: 'Organization not found',
        });
      }
      const bookingsOut =
        await this.bookingsRepository.cancelAllActiveBookingsAtOrganization(
          tx,
          {
            organizationId,
            actorUserId: userId,
            cancelReason: BOOKING_CANCEL_REASON_ORGANIZATION_DELETED_EN,
            cancellationComment: null,
          },
        );
      const workplaceSpecialists = await tx.specialist.findMany({
        where: { activeOrganizationId: organizationId },
        select: { id: true },
      });
      for (const s of workplaceSpecialists) {
        await tx.specialist.update({
          where: { id: s.id },
          data: { activeOrganizationId: null },
        });
        await this.syncSpecialistListedInDirectory(tx, s.id);
      }
      await tx.service.updateMany({
        where: { organizationId, deletedAt: null },
        data: { deletedAt: now, isActive: false },
      });
      await tx.specialistOrganizationEmployment.updateMany({
        where: { organizationId, isActive: true },
        data: { isActive: false, endDate: now },
      });
      await tx.specialistWorkplaceJoinRequest.updateMany({
        where: {
          organizationId,
          status: SpecialistWorkplaceJoinRequestStatus.pending,
        },
        data: {
          status: SpecialistWorkplaceJoinRequestStatus.withdrawn,
          resolvedAt: now,
        },
      });
      await tx.organization.update({
        where: { id: organizationId },
        data: { deletedAt: now },
      });
      return bookingsOut;
    });
    for (const row of cancelled) {
      void this.pushNotifications.notifyClientBookingStatusChange(
        row.id,
        row.fromStatus,
        row.toStatus,
      );
    }
    return { ok: true, cancelledBookingsCount: cancelled.length };
  }

  private async assertUserCanManageOrgWorkplaceJoinRequests(
    userId: string,
    organizationId: string,
  ): Promise<void> {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { id: true, ownerUserId: true },
    });
    if (!org) {
      throw new NotFoundException({
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Organization not found',
      });
    }
    if (org.ownerUserId === userId) {
      return;
    }
    const specialist = await this.prisma.specialist.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    if (!specialist) {
      throw new ForbiddenException({
        code: 'NOT_ORGANIZATION_MANAGER',
        message:
          'Only the organization owner or an active admin can manage workplace join requests',
      });
    }
    const emp = await this.prisma.specialistOrganizationEmployment.findFirst({
      where: {
        specialistId: specialist.id,
        organizationId,
        isActive: true,
        role: {
          in: [
            OrganizationMembershipRole.owner,
            OrganizationMembershipRole.admin,
          ],
        },
      },
      select: { id: true },
    });
    if (!emp) {
      throw new ForbiddenException({
        code: 'NOT_ORGANIZATION_MANAGER',
        message:
          'Only the organization owner or an active admin can manage workplace join requests',
      });
    }
  }

  /**
   * Заявка мастера «хочу работать в этой организации» (без членства до решения owner/admin).
   * Текущее место приёма не ограничивает отправку заявок в другие салоны.
   */
  async requestWorkplaceJoin(userId: string, organizationId: string) {
    const specialist = await this.prisma.specialist.findFirst({
      where: { userId, deletedAt: null },
    });
    if (!specialist) {
      throw new NotFoundException({
        code: 'SPECIALIST_PROFILE_NOT_FOUND',
        message: 'Specialist profile not found for this user',
      });
    }
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
    });
    if (!org) {
      throw new NotFoundException({
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Organization not found',
      });
    }
    const alreadyMember =
      await this.prisma.specialistOrganizationEmployment.findFirst({
        where: {
          specialistId: specialist.id,
          organizationId,
          isActive: true,
        },
      });
    if (alreadyMember) {
      throw new ConflictException({
        code: 'ALREADY_ORGANIZATION_MEMBER',
        message: 'You are already an active member of this organization',
      });
    }
    const existingPair =
      await this.prisma.specialistWorkplaceJoinRequest.findUnique({
        where: {
          specialistId_organizationId: {
            specialistId: specialist.id,
            organizationId,
          },
        },
        select: { status: true },
      });
    if (existingPair?.status === SpecialistWorkplaceJoinRequestStatus.blocked) {
      throw new ForbiddenException({
        code: 'WORKPLACE_JOIN_BLOCKED',
        message:
          'This organization has blocked further workplace requests from you',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.specialistWorkplaceJoinRequest.updateMany({
        where: {
          specialistId: specialist.id,
          status: SpecialistWorkplaceJoinRequestStatus.pending,
        },
        data: {
          status: SpecialistWorkplaceJoinRequestStatus.withdrawn,
          resolvedAt: new Date(),
        },
      });
      await tx.specialistWorkplaceJoinRequest.upsert({
        where: {
          specialistId_organizationId: {
            specialistId: specialist.id,
            organizationId,
          },
        },
        create: {
          specialistId: specialist.id,
          organizationId,
          status: SpecialistWorkplaceJoinRequestStatus.pending,
        },
        update: {
          status: SpecialistWorkplaceJoinRequestStatus.pending,
          resolvedAt: null,
        },
      });
    });
    return this.specialistOnboarding.getOnboarding(userId);
  }

  /**
   * Салоны для выбора места работы (заявка в штат). Без правил публичной витрины
   * по мастерам/OSC — иначе новые салоны и салоны без мастеров в каталоге не находятся.
   * В выдаче только организации с **`publicationModerationStatus === approved`** (после модерации публикации).
   */
  async searchOrganizationsForWorkplaceJoin(
    locale: ApiLocale,
    q: string | null,
    limit: number,
  ): Promise<WorkplaceOrganizationSearchResponseDto> {
    const take = Math.min(Math.max(limit, 1), 50);
    const where: Prisma.OrganizationWhereInput = {
      deletedAt: null,
      publicationModerationStatus: PublicationModerationStatus.approved,
    };
    if (q) {
      where.AND = [organizationNonCategoryTextSearchWhere(q, locale)];
    }
    const rows = await this.prisma.organization.findMany({
      where,
      take,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        ratingAverage: true,
        reviewsCount: true,
        address: {
          select: {
            addressLine: true,
            city: true,
            latitude: true,
            longitude: true,
          },
        },
        locales: { orderBy: { locale: 'asc' } },
      },
    });
    const organizations = rows.map((row) => {
      const picked = pickLocalizedOrganizationListItem(
        {
          id: row.id,
          slug: row.slug,
          name: row.name,
          description: row.description ?? null,
          address: row.address,
          ratingAverage: row.ratingAverage,
          reviewsCount: row.reviewsCount,
          imageUrl: null,
          imageAlt: null,
          locales: row.locales,
        },
        locale,
      );
      return {
        id: picked.id,
        name: picked.name,
        addressLine: row.address?.addressLine ?? null,
        city: picked.city,
      };
    });
    return { organizations };
  }

  async listWorkplaceJoinRequestsForOrganization(
    userId: string,
    organizationId: string,
    query: WorkplaceJoinRequestListQuery,
  ) {
    await this.assertUserCanManageOrgWorkplaceJoinRequests(
      userId,
      organizationId,
    );
    const rawStatus = query.status ?? 'pending';
    const where: Prisma.SpecialistWorkplaceJoinRequestWhereInput = {
      organizationId,
    };
    if (rawStatus !== 'all') {
      where.status = rawStatus as SpecialistWorkplaceJoinRequestStatus;
    }
    const rows = await this.prisma.specialistWorkplaceJoinRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        specialist: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
    return {
      requests: rows.map((r) => ({
        id: r.id,
        specialistId: r.specialistId,
        organizationId: r.organizationId,
        status: r.status,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        resolvedAt: r.resolvedAt,
        specialist: r.specialist,
      })),
    };
  }

  /**
   * Карточка мастера для владельца/админа салона: только при активной pending-заявке в эту организацию.
   * Формат `specialist` совпадает с GET /specialists/me/onboarding.
   */
  async getWorkplaceJoinApplicantCabinetProfile(
    managerUserId: string,
    organizationId: string,
    applicantSpecialistId: string,
    locale: ApiLocale,
  ): Promise<{ specialist: Record<string, unknown> }> {
    await this.assertUserCanManageOrgWorkplaceJoinRequests(
      managerUserId,
      organizationId,
    );
    const pending =
      await this.prisma.specialistWorkplaceJoinRequest.findFirst({
        where: {
          organizationId,
          specialistId: applicantSpecialistId,
          status: SpecialistWorkplaceJoinRequestStatus.pending,
        },
        select: { id: true },
      });
    if (!pending) {
      throw new NotFoundException({
        code: 'WORKPLACE_JOIN_REQUEST_NOT_FOUND',
        message:
          'Pending workplace join request not found for this specialist',
      });
    }
    const specialist =
      await this.specialistOnboarding.buildSpecialistCabinetSnapshotForSpecialistId(
        applicantSpecialistId,
        locale,
      );
    if (!specialist) {
      throw new NotFoundException({
        code: 'SPECIALIST_PROFILE_NOT_FOUND',
        message: 'Specialist profile not found',
      });
    }
    return { specialist };
  }

  async reviewWorkplaceJoinRequest(
    actingUserId: string | null,
    organizationId: string,
    requestId: string,
    body: WorkplaceJoinRequestReviewBody,
    options?: { skipManagerAuth?: boolean },
  ) {
    if (!options?.skipManagerAuth) {
      if (actingUserId == null) {
        throw new ForbiddenException({
          code: 'UNAUTHORIZED_REVIEW',
          message: 'Reviewer user id required',
        });
      }
      await this.assertUserCanManageOrgWorkplaceJoinRequests(
        actingUserId,
        organizationId,
      );
    }
    const joinRow = await this.prisma.specialistWorkplaceJoinRequest.findFirst({
      where: {
        id: requestId,
        organizationId,
        status: SpecialistWorkplaceJoinRequestStatus.pending,
      },
    });
    if (!joinRow) {
      throw new NotFoundException({
        code: 'WORKPLACE_JOIN_REQUEST_NOT_FOUND',
        message: 'Pending join request not found',
      });
    }
    const specialistRow = await this.prisma.specialist.findFirst({
      where: { id: joinRow.specialistId, deletedAt: null },
      select: { id: true },
    });
    if (!specialistRow) {
      throw new NotFoundException({
        code: 'SPECIALIST_PROFILE_NOT_FOUND',
        message: 'Specialist profile not found',
      });
    }

    if (body.decision === 'accept') {
      await this.prisma.$transaction(async (tx) => {
        await tx.specialistWorkplaceJoinRequest.update({
          where: { id: requestId },
          data: {
            status: SpecialistWorkplaceJoinRequestStatus.accepted,
            resolvedAt: new Date(),
          },
        });
        await tx.specialistWorkplaceJoinRequest.updateMany({
          where: {
            specialistId: joinRow.specialistId,
            status: SpecialistWorkplaceJoinRequestStatus.pending,
            id: { not: requestId },
          },
          data: {
            status: SpecialistWorkplaceJoinRequestStatus.withdrawn,
            resolvedAt: new Date(),
          },
        });
        await this.grantSpecialistMembershipAtOrganization(
          tx,
          joinRow.specialistId,
          organizationId,
        );
      });
    } else if (body.decision === 'reject') {
      await this.prisma.specialistWorkplaceJoinRequest.update({
        where: { id: requestId },
        data: {
          status: SpecialistWorkplaceJoinRequestStatus.rejected,
          resolvedAt: new Date(),
        },
      });
    } else {
      await this.prisma.specialistWorkplaceJoinRequest.update({
        where: { id: requestId },
        data: {
          status: SpecialistWorkplaceJoinRequestStatus.blocked,
          resolvedAt: new Date(),
        },
      });
    }

    return { ok: true as const, decision: body.decision };
  }

  /**
   * Dev-only: решение по заявке приходит с одним `requestId` (без organizationId в URL).
   */
  async reviewPendingWorkplaceJoinRequestForDev(
    requestId: string,
    body: WorkplaceJoinRequestReviewBody,
  ) {
    const pending = await this.prisma.specialistWorkplaceJoinRequest.findFirst({
      where: {
        id: requestId,
        status: SpecialistWorkplaceJoinRequestStatus.pending,
      },
      select: { organizationId: true },
    });
    if (!pending) {
      throw new NotFoundException({
        code: 'WORKPLACE_JOIN_REQUEST_NOT_FOUND',
        message: 'Pending join request not found',
      });
    }
    return this.reviewWorkplaceJoinRequest(
      null,
      pending.organizationId,
      requestId,
      body,
      { skipManagerAuth: true },
    );
  }

  private slugifyOrganizationName(name: string): string {
    const base = name
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    return base.length > 0 ? base : 'salon';
  }

  private async resolveMajorCategoriesForOrganization(
    slugs: string[] | undefined,
  ): Promise<{
    primaryMajorCategoryId: string;
    additionalMajorCategoryIds: string[];
    additionalMajorCategorySlugs: string[];
  }> {
    const primary = await this.prisma.majorServiceCategory.findFirst({
      where: { slug: 'massage', deletedAt: null, isActive: true },
      select: { id: true, slug: true },
    });
    if (!primary) {
      throw new BadRequestException({
        code: 'PRIMARY_MAJOR_CATEGORY_NOT_FOUND',
        message: 'Primary major category massage is not configured',
      });
    }
    const uniqSlugs = [...new Set((slugs ?? []).map((s) => s.trim().toLowerCase()))]
      .filter((s) => s.length > 0 && s !== primary.slug);
    if (uniqSlugs.length === 0) {
      return {
        primaryMajorCategoryId: primary.id,
        additionalMajorCategoryIds: [],
        additionalMajorCategorySlugs: [],
      };
    }
    const rows = await this.prisma.majorServiceCategory.findMany({
      where: {
        slug: { in: uniqSlugs },
        deletedAt: null,
        isActive: true,
      },
      select: { id: true, slug: true },
    });
    if (rows.length !== uniqSlugs.length) {
      throw new BadRequestException({
        code: 'INVALID_ADDITIONAL_MAJOR_CATEGORIES',
        message: 'One or more additional major category slugs are invalid',
      });
    }
    return {
      primaryMajorCategoryId: primary.id,
      additionalMajorCategoryIds: rows.map((r) => r.id),
      additionalMajorCategorySlugs: rows.map((r) => r.slug),
    };
  }

  /**
   * Создать салон: текущий пользователь — владелец в БД (`Organization.ownerUserId`),
   * мастер получает роль owner в новой организации.
   * Если активное место приёма уже выбрано, оно не меняется — новый салон доступен как владение до переключения вручную.
   */
  async createOrganizationAsOwner(
    userId: string,
    body: CreateOrganizationBody,
    locale: ApiLocale,
  ) {
    const specialist = await this.prisma.specialist.findFirst({
      where: { userId, deletedAt: null },
    });
    if (!specialist) {
      throw new NotFoundException({
        code: 'SPECIALIST_PROFILE_NOT_FOUND',
        message: 'Specialist profile not found for this user',
      });
    }
    const hadActiveWorkplace = specialist.activeOrganizationId != null;
    const majors = await this.resolveMajorCategoriesForOrganization(
      body.additionalMajorCategorySlugs,
    );
    const categories = await this.prisma.serviceCategory.findMany({
      where: {
        id: { in: body.serviceCategoryIds },
        deletedAt: null,
        isActive: true,
      },
      select: { id: true },
    });
    if (categories.length !== body.serviceCategoryIds.length) {
      throw new BadRequestException({
        code: 'INVALID_SERVICE_CATEGORIES',
        message: 'One or more service categories are invalid or inactive',
      });
    }

    const orgId = randomUUID();
    const slug = `${this.slugifyOrganizationName(body.name)}-${orgId.slice(0, 8)}`;

    const norm = (s: string | null | undefined): string | null => {
      if (s == null) {
        return null;
      }
      const t = String(s).trim();
      return t.length > 0 ? t : null;
    };

    let addressLine: string;
    let cityForDb: string | null;
    let latitude: number;
    let longitude: number;
    let sourceProvider: string;
    let sourceReference: string | null;
    if (body.placeReference) {
      const useClientPin =
        body.latitude != null &&
        body.longitude != null &&
        Number.isFinite(body.latitude) &&
        Number.isFinite(body.longitude);
      if (useClientPin) {
        addressLine = body.addressLine!.trim();
        cityForDb = norm(body.city);
        latitude = body.latitude!;
        longitude = body.longitude!;
        sourceProvider = body.placeReference.provider;
        sourceReference = body.placeReference.placeId;
      } else {
        const resolved = await this.addressResolution.resolveToCanonical(
          body.placeReference.provider,
          body.placeReference.placeId,
          { locale },
        );
        addressLine = resolved.addressLine.trim();
        cityForDb = norm(resolved.city);
        latitude = resolved.latitude;
        longitude = resolved.longitude;
        sourceProvider = body.placeReference.provider;
        sourceReference = body.placeReference.placeId;
      }
    } else {
      addressLine = body.addressLine!.trim();
      cityForDb = norm(body.city);
      latitude = body.latitude!;
      longitude = body.longitude!;
      sourceProvider = 'manual';
      sourceReference = null;
    }

    let profileRevisionId!: string;

    await this.prisma.$transaction(async (tx) => {
      if (!hadActiveWorkplace) {
        await tx.specialistWorkplaceJoinRequest.updateMany({
          where: {
            specialistId: specialist.id,
            status: SpecialistWorkplaceJoinRequestStatus.pending,
          },
          data: {
            status: SpecialistWorkplaceJoinRequestStatus.withdrawn,
            resolvedAt: new Date(),
          },
        });
      }
      const addr = await this.addressPersistence.createInTransaction(tx, {
        addressLine,
        city: cityForDb,
        latitude,
        longitude,
        sourceProvider,
        sourceReference,
      });
      const gallerySeed: Array<{
        url: string;
        alt: string | null;
        kind: GalleryMediaKind;
      }> = [];
      const primaryUrl = norm(body.imageUrl);
      if (primaryUrl) {
        gallerySeed.push({
          url: primaryUrl,
          alt: norm(body.imageAlt),
          kind: GalleryMediaKind.image,
        });
      }
      for (const raw of body.galleryImageUrls ?? []) {
        const u = raw.trim();
        if (u.length === 0) {
          continue;
        }
        if (gallerySeed.some((row) => row.url === u)) {
          continue;
        }
        gallerySeed.push({
          url: u,
          alt: null,
          kind: GalleryMediaKind.image,
        });
      }
      await tx.organization.create({
        data: {
          id: orgId,
          name: body.name.trim(),
          slug,
          ownerUserId: userId,
          description: norm(body.description),
          phone: norm(body.phone),
          email: norm(body.email),
          website: norm(body.website),
          addressId: addr.id,
          primaryMajorServiceCategoryId: majors.primaryMajorCategoryId,
          yearsInBusiness: body.yearsInBusiness ?? null,
          publicationModerationStatus:
            PublicationModerationStatus.pending_review,
        },
      });

      await tx.organizationLocale.create({
        data: {
          organizationId: orgId,
          locale,
          name: body.name.trim(),
          description: norm(body.description),
        },
      });

      if (gallerySeed.length > 0) {
        const gallery = await tx.gallery.create({
          data: {
            ownerKind: GalleryOwnerKind.organization,
            ownerId: orgId,
          },
        });
        await this.gallery.seedItemsInTransaction(tx, gallery.id, gallerySeed);
      }

      const draftName = body.name.trim();
      const draftDesc = norm(body.description);
      const revision = await tx.organizationProfileRevision.create({
        data: {
          organizationId: orgId,
          status: OrganizationProfileRevisionStatus.pending_review,
          catalogLocale: locale,
          name: draftName,
          description: draftDesc ?? undefined,
          phone: norm(body.phone),
          email: norm(body.email)?.toLowerCase() ?? null,
          website: norm(body.website),
          yearsInBusiness: body.yearsInBusiness ?? null,
          addressLine,
          city: cityForDb,
          latitude,
          longitude,
          addressSourceProvider: sourceProvider,
          addressSourceReference: sourceReference,
          serviceCategories: {
            create: body.serviceCategoryIds.map((serviceCategoryId) => ({
              serviceCategoryId,
            })),
          },
        },
      });
      profileRevisionId = revision.id;

      if (gallerySeed.length > 0) {
        const revisionGallery = await tx.gallery.create({
          data: {
            ownerKind: GalleryOwnerKind.organization_profile_revision,
            ownerId: revision.id,
          },
        });
        await this.gallery.seedItemsInTransaction(
          tx,
          revisionGallery.id,
          gallerySeed,
        );
      }

      for (const catId of body.serviceCategoryIds) {
        await tx.organizationServiceCategory.create({
          data: {
            organizationId: orgId,
            serviceCategoryId: catId,
          },
        });
      }
      if (majors.additionalMajorCategoryIds.length > 0) {
        await tx.organizationAdditionalMajorCategory.createMany({
          data: majors.additionalMajorCategoryIds.map((majorServiceCategoryId) => ({
            organizationId: orgId,
            majorServiceCategoryId,
          })),
        });
      }

      const startDate = new Date();
      await tx.specialistOrganizationEmployment.create({
        data: {
          specialistId: specialist.id,
          organizationId: orgId,
          role: OrganizationMembershipRole.owner,
          startDate,
          isActive: true,
        },
      });

      if (!hadActiveWorkplace) {
        await tx.specialist.update({
          where: { id: specialist.id },
          data: { activeOrganizationId: orgId },
        });
      }

      const fresh = await tx.specialist.findFirst({
        where: { id: specialist.id },
        select: { onboardingCompletedAt: true, activeOrganizationId: true },
      });
      if (fresh) {
        await tx.specialist.update({
          where: { id: specialist.id },
          data: {
            listedInDirectory: computeListedInDirectory({
              onboardingCompletedAt: fresh.onboardingCompletedAt,
              activeOrganizationId: fresh.activeOrganizationId,
            }),
          },
        });
      }
    });

    await this.moderationEnqueue.enqueueOrganizationProfileModeration(
      profileRevisionId,
    );

    return this.specialistOnboarding.getOnboarding(userId);
  }

  /**
   * Поля салона для формы редактирования (владелец БД или активный admin по employment).
   */
  async getCabinetOrganizationProfileForEdit(
    userId: string,
    organizationId: string,
    locale: ApiLocale,
  ): Promise<OrganizationCabinetEditProfileDto> {
    await this.assertUserCanManageOrgWorkplaceJoinRequests(
      userId,
      organizationId,
    );
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: {
        primaryMajorServiceCategory: { select: { slug: true } },
        additionalMajorCategories: {
          include: { majorServiceCategory: { select: { slug: true } } },
        },
        name: true,
        description: true,
        phone: true,
        email: true,
        website: true,
        yearsInBusiness: true,
        address: {
          select: {
            addressLine: true,
            city: true,
            latitude: true,
            longitude: true,
            sourceProvider: true,
            sourceReference: true,
          },
        },
        locales: {
          where: { locale },
          take: 1,
          select: { name: true, description: true },
        },
        serviceCategories: { select: { serviceCategoryId: true } },
      },
    });
    if (!org) {
      throw new NotFoundException({
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Organization not found',
      });
    }

    const pendingRevision =
      await this.prisma.organizationProfileRevision.findFirst({
        where: {
          organizationId,
          status: OrganizationProfileRevisionStatus.pending_review,
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          phone: true,
          email: true,
          website: true,
          yearsInBusiness: true,
          addressLine: true,
          city: true,
          latitude: true,
          longitude: true,
          addressSourceProvider: true,
          addressSourceReference: true,
          serviceCategories: { select: { serviceCategoryId: true } },
        },
      });

    const useDraft = pendingRevision != null;

    const loc = org.locales[0];
    const liveName = loc?.name?.trim() || org.name.trim() || '';
    const liveDescription =
      loc?.description !== undefined && loc?.description !== null
        ? loc.description
        : (org.description ?? null);

    const name = useDraft ? pendingRevision.name.trim() || liveName : liveName;
    const description = useDraft
      ? pendingRevision.description
      : liveDescription;

    let placeReference: {
      provider: 'locationiq' | 'geoapify' | 'opencage' | 'nominatim';
      placeId: string;
    } | null = null;
    const sp = useDraft
      ? pendingRevision.addressSourceProvider
      : org.address?.sourceProvider;
    const sr = useDraft
      ? pendingRevision.addressSourceReference
      : org.address?.sourceReference;
    if (
      sp != null &&
      sr != null &&
      CABINET_ALLOWED_PLACE_PROVIDERS.has(
        sp as 'locationiq' | 'geoapify' | 'opencage' | 'nominatim',
      )
    ) {
      placeReference = {
        provider: sp as 'locationiq' | 'geoapify' | 'opencage' | 'nominatim',
        placeId: sr,
      };
    }

    const galleryOwner = useDraft
      ? {
          ownerKind: GalleryOwnerKind.organization_profile_revision,
          ownerId: pendingRevision.id,
        }
      : {
          ownerKind: GalleryOwnerKind.organization,
          ownerId: organizationId,
        };

    const galleryRecord = await this.prisma.gallery.findUnique({
      where: {
        ownerKind_ownerId: galleryOwner,
      },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          select: { url: true, alt: true },
        },
      },
    });
    const galleryItems =
      galleryRecord?.items.map((it) => ({
        url: it.url,
        alt: it.alt,
      })) ?? [];

    return {
      primaryMajorCategorySlug:
        org.primaryMajorServiceCategory?.slug ?? 'massage',
      additionalMajorCategorySlugs: org.additionalMajorCategories.map(
        (row) => row.majorServiceCategory.slug,
      ),
      name,
      description,
      phone: useDraft ? pendingRevision.phone : org.phone,
      email: useDraft ? pendingRevision.email : org.email,
      website: useDraft ? pendingRevision.website : org.website,
      yearsInBusiness: useDraft
        ? pendingRevision.yearsInBusiness
        : org.yearsInBusiness,
      addressLine: useDraft
        ? (pendingRevision.addressLine ?? null)
        : (org.address?.addressLine ?? null),
      city: useDraft ? pendingRevision.city : (org.address?.city ?? null),
      latitude: useDraft
        ? pendingRevision.latitude
        : (org.address?.latitude ?? null),
      longitude: useDraft
        ? pendingRevision.longitude
        : (org.address?.longitude ?? null),
      placeReference,
      serviceCategoryIds: useDraft
        ? pendingRevision.serviceCategories.map((r) => r.serviceCategoryId)
        : org.serviceCategories.map((r) => r.serviceCategoryId),
      galleryItems,
    };
  }

  /**
   * Все поля из формы кабинета — снимком в новой ревизии (`OrganizationProfileRevision` + её галерея
   * и связи категорий). Живая строка салона для гостей обновится после промоута ревизии
   * (`promoteOrganizationProfileRevision`).
   */
  async patchOrganizationAsManager(
    userId: string,
    organizationId: string,
    body: CreateOrganizationBody,
    locale: ApiLocale,
  ) {
    await this.assertUserCanManageOrgWorkplaceJoinRequests(
      userId,
      organizationId,
    );
    const majors = await this.resolveMajorCategoriesForOrganization(
      body.additionalMajorCategorySlugs,
    );
    const categories = await this.prisma.serviceCategory.findMany({
      where: {
        id: { in: body.serviceCategoryIds },
        deletedAt: null,
        isActive: true,
      },
      select: { id: true },
    });
    if (categories.length !== body.serviceCategoryIds.length) {
      throw new BadRequestException({
        code: 'INVALID_SERVICE_CATEGORIES',
        message: 'One or more service categories are invalid or inactive',
      });
    }

    const norm = (s: string | null | undefined): string | null => {
      if (s == null) {
        return null;
      }
      const t = String(s).trim();
      return t.length > 0 ? t : null;
    };

    let addressLine: string;
    let cityForDb: string | null;
    let latitude: number;
    let longitude: number;
    let sourceProvider: string;
    let sourceReference: string | null;
    if (body.placeReference) {
      const useClientPin =
        body.latitude != null &&
        body.longitude != null &&
        Number.isFinite(body.latitude) &&
        Number.isFinite(body.longitude);
      if (useClientPin) {
        addressLine = body.addressLine!.trim();
        cityForDb = norm(body.city);
        latitude = body.latitude!;
        longitude = body.longitude!;
        sourceProvider = body.placeReference.provider;
        sourceReference = body.placeReference.placeId;
      } else {
        const resolved = await this.addressResolution.resolveToCanonical(
          body.placeReference.provider,
          body.placeReference.placeId,
          { locale },
        );
        addressLine = resolved.addressLine.trim();
        cityForDb = norm(resolved.city);
        latitude = resolved.latitude;
        longitude = resolved.longitude;
        sourceProvider = body.placeReference.provider;
        sourceReference = body.placeReference.placeId;
      }
    } else {
      addressLine = body.addressLine!.trim();
      cityForDb = norm(body.city);
      latitude = body.latitude!;
      longitude = body.longitude!;
      sourceProvider = 'manual';
      sourceReference = null;
    }

    let profileRevisionId!: string;

    await this.prisma.$transaction(async (tx) => {
      const head = await tx.organization.findFirst({
        where: { id: organizationId, deletedAt: null },
        select: {
          id: true,
          primaryMajorServiceCategoryId: true,
          additionalMajorCategories: {
            select: { majorServiceCategoryId: true },
          },
        },
      });
      if (!head) {
        throw new NotFoundException({
          code: 'ORGANIZATION_NOT_FOUND',
          message: 'Organization not found',
        });
      }
      const prevAdditionalIds = new Set(
        head.additionalMajorCategories.map((row) => row.majorServiceCategoryId),
      );
      const nextAdditionalIds = new Set(majors.additionalMajorCategoryIds);
      const removedAdditionalIds = [...prevAdditionalIds].filter(
        (id) => !nextAdditionalIds.has(id),
      );
      if (removedAdditionalIds.length > 0) {
        const affected = await tx.service.findMany({
          where: {
            organizationId,
            deletedAt: null,
            isActive: true,
            category: {
              deletedAt: null,
              majorServiceCategoryId: { in: removedAdditionalIds },
            },
          },
          select: {
            id: true,
            category: {
              select: {
                id: true,
                name: true,
                shortName: true,
                slug: true,
              },
            },
          },
        });
        if (affected.length > 0) {
          const provided = new Set(body.confirmDisableServiceIds ?? []);
          const allConfirmed = affected.every((row) => provided.has(row.id));
          if (!allConfirmed) {
            throw new ConflictException({
              code: 'ADDITIONAL_MAJOR_DISABLE_CONFIRM_REQUIRED',
              message:
                'Removing additional major categories requires confirmation for affected active services',
              affectedServices: affected.map((row) => ({
                id: row.id,
                categoryId: row.category.id,
                categorySlug: row.category.slug,
                categoryName: row.category.shortName ?? row.category.name,
              })),
            });
          }
          await tx.service.updateMany({
            where: {
              id: { in: affected.map((row) => row.id) },
              deletedAt: null,
              isActive: true,
            },
            data: { isActive: false },
          });
          this.logger.warn(
            `additional major categories removed at organization ${organizationId}; deactivated services: ${affected
              .map((row) => row.id)
              .join(', ')}`,
          );
        }
      }
      await tx.organization.update({
        where: { id: organizationId },
        data: { primaryMajorServiceCategoryId: majors.primaryMajorCategoryId },
      });
      await tx.organizationAdditionalMajorCategory.deleteMany({
        where: { organizationId },
      });
      if (majors.additionalMajorCategoryIds.length > 0) {
        await tx.organizationAdditionalMajorCategory.createMany({
          data: majors.additionalMajorCategoryIds.map((majorServiceCategoryId) => ({
            organizationId,
            majorServiceCategoryId,
          })),
        });
      }

      const gallerySeed: Array<{
        url: string;
        alt: string | null;
        kind: GalleryMediaKind;
      }> = [];
      const primaryUrl = norm(body.imageUrl);
      if (primaryUrl) {
        gallerySeed.push({
          url: primaryUrl,
          alt: norm(body.imageAlt),
          kind: GalleryMediaKind.image,
        });
      }
      for (const raw of body.galleryImageUrls ?? []) {
        const u = raw.trim();
        if (u.length === 0) {
          continue;
        }
        if (gallerySeed.some((row) => row.url === u)) {
          continue;
        }
        gallerySeed.push({
          url: u,
          alt: null,
          kind: GalleryMediaKind.image,
        });
      }

      const draftName = body.name.trim();
      const draftDesc = norm(body.description);

      const staleRevisionIds = (
        await tx.organizationProfileRevision.findMany({
          where: {
            organizationId,
            status: OrganizationProfileRevisionStatus.pending_review,
          },
          select: { id: true },
        })
      ).map((r) => r.id);
      if (staleRevisionIds.length > 0) {
        await tx.organizationProfileRevision.updateMany({
          where: { id: { in: staleRevisionIds } },
          data: { status: OrganizationProfileRevisionStatus.superseded },
        });
        await tx.contentModerationCase.updateMany({
          where: {
            kind: ContentModerationCaseKind.organization_profile,
            subjectId: { in: staleRevisionIds },
            status: ContentModerationCaseStatus.open,
          },
          data: {
            status: ContentModerationCaseStatus.resolved_rejected,
            moderatorReason: 'Superseded by a newer submission',
            resolvedAt: new Date(),
          },
        });
      }

      const revision = await tx.organizationProfileRevision.create({
        data: {
          organizationId,
          status: OrganizationProfileRevisionStatus.pending_review,
          catalogLocale: locale,
          name: draftName,
          description: draftDesc ?? undefined,
          phone: norm(body.phone),
          email: norm(body.email)?.toLowerCase() ?? null,
          website: norm(body.website),
          yearsInBusiness: body.yearsInBusiness ?? null,
          addressLine,
          city: cityForDb,
          latitude,
          longitude,
          addressSourceProvider: sourceProvider,
          addressSourceReference: sourceReference,
          serviceCategories: {
            create: body.serviceCategoryIds.map((serviceCategoryId) => ({
              serviceCategoryId,
            })),
          },
        },
      });
      profileRevisionId = revision.id;

      if (gallerySeed.length > 0) {
        const revisionGallery = await tx.gallery.create({
          data: {
            ownerKind: GalleryOwnerKind.organization_profile_revision,
            ownerId: revision.id,
          },
        });
        await this.gallery.seedItemsInTransaction(
          tx,
          revisionGallery.id,
          gallerySeed,
        );
      }
    });

    await this.moderationEnqueue.enqueueOrganizationProfileModeration(
      profileRevisionId,
    );

    return this.specialistOnboarding.getOnboarding(userId);
  }
}
