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
  OrganizationType,
  OfferingPublicationStatus,
  PublicationModerationStatus,
  SpecialistWorkPattern,
  SpecialistWorkplaceJoinRequestStatus,
  type BookingStatus,
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
import { BookingAppendService } from '../../bookings/application/booking-append.service';
import { BOOKING_CANCEL_REASON_ORGANIZATION_DELETED_EN } from '../../bookings/domain/booking-cancel-reason';
import { appendInputMassOrganizationCancelBooking } from '../../bookings/domain/booking-mass-organization-cancel';
import { BookingStatusLocaleRepository } from '../../bookings/infrastructure/booking-status-locale.repository';
import { BookingsRepository } from '../../bookings/infrastructure/bookings.repository';
import { organizationNonCategoryTextSearchWhere } from '../../directory/infrastructure/directory-list-query-filters';
import { AddressPersistenceService } from '../../address/application/address-persistence.service';
import { AddressResolutionService } from '../../address/application/address-resolution.service';
import { GalleryService } from '../../gallery/application/gallery.service';
import { ModerationEnqueueService } from '../../moderation/application/moderation-enqueue.service';
import { PushNotificationsService } from '../../notifications/application/push-notifications.service';
import { SpecialistOfferingEdgeLifecycleService } from '../../directory/application/specialist-offering-edge-lifecycle.service';
import { SpecialistOnboardingService } from '../../specialists/application/specialist-onboarding.service';
import { computeListedInDirectory } from '../../specialists/domain/specialist-directory-flags';
import { OrganizationAccessPolicyService } from './organization-access-policy.service';
import {
  OrganizationCapabilities,
  assertCanOrganization,
} from '../domain/policy';
import type { OrganizationScopedPermissions } from '../domain/organization-permissions';
import type { CreateOrganizationBody } from '../dto/create-organization-body.schema';
import type { OrganizationTeamRoleBody } from '../dto/organization-team-role.schema';
import { mergeOrganizationMajorIdsAndSlugsFromDb } from '../lib/merge-organization-major-categories';
import { syncOrganizationServiceCategoriesFromPublishedOfferings } from '../infrastructure/organization-service-category-sync';
import type { WorkplaceOrganizationSearchResponseDto } from '../dto/workplace-organization-search.dto';
import type {
  WorkplaceJoinRequestListQuery,
  WorkplaceJoinRequestReviewBody,
} from '../dto/workplace-join-request.schema';

const CABINET_ALLOWED_PLACE_PROVIDERS = new Set<
  'locationiq' | 'geoapify' | 'opencage' | 'nominatim'
>(['locationiq', 'geoapify', 'opencage', 'nominatim']);

export type OrganizationCabinetEditProfileDto = {
  /** Все выбранные «сферы деятельности» (большие категории), по slug. */
  majorCategorySlugs: string[];
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
  galleryItems: Array<{ url: string; alt: string | null }>;
};

@Injectable()
export class OrganizationCabinetService {
  private async assertServiceCategoriesBelongToOrganizationMajors(
    serviceCategoryIds: string[],
    organizationMajorCategoryIds: string[],
  ): Promise<void> {
    if (serviceCategoryIds.length === 0) {
      return;
    }
    if (organizationMajorCategoryIds.length === 0) {
      throw new BadRequestException({
        code: 'SERVICE_CATEGORIES_REQUIRE_ORGANIZATION_MAJORS',
        message:
          'Cannot attach service categories while the organization has no activity majors selected',
      });
    }
    const allowed = new Set<string>(organizationMajorCategoryIds);
    const rows = await this.prisma.serviceCategory.findMany({
      where: {
        id: { in: serviceCategoryIds },
        deletedAt: null,
        isActive: true,
      },
      select: { id: true, majorServiceCategoryId: true },
    });
    if (rows.length !== serviceCategoryIds.length) {
      throw new BadRequestException({
        code: 'INVALID_SERVICE_CATEGORIES',
        message: 'One or more service categories are invalid or inactive',
      });
    }
    for (const row of rows) {
      if (!allowed.has(row.majorServiceCategoryId)) {
        throw new BadRequestException({
          code: 'SERVICE_CATEGORY_MAJOR_NOT_ALLOWED_FOR_ORGANIZATION',
          message:
            'One or more service categories belong to a major not enabled for this organization',
        });
      }
    }
  }

  private readonly logger = new Logger(OrganizationCabinetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly addressResolution: AddressResolutionService,
    private readonly addressPersistence: AddressPersistenceService,
    private readonly gallery: GalleryService,
    private readonly specialistOnboarding: SpecialistOnboardingService,
    private readonly moderationEnqueue: ModerationEnqueueService,
    private readonly bookingsRepository: BookingsRepository,
    private readonly bookingAppend: BookingAppendService,
    private readonly bookingStatusLocaleRepository: BookingStatusLocaleRepository,
    private readonly pushNotifications: PushNotificationsService,
    private readonly specialistOfferingEdgeLifecycle: SpecialistOfferingEdgeLifecycleService,
    private readonly organizationAccess: OrganizationAccessPolicyService,
  ) {}

  /** Все активные брони организации (все мастера) — append массовой отмены при удалении салона. */
  private async massCancelAllActiveBookingsAtOrganizationTx(
    tx: Prisma.TransactionClient,
    args: {
      organizationId: string;
      actorUserId: string;
      cancelReason: string;
      cancellationComment: string | null;
    },
  ): Promise<
    Array<{ id: string; fromStatus: BookingStatus; toStatus: BookingStatus }>
  > {
    const rows =
      await this.bookingsRepository.findActiveMinimalForOrganizationAll(
        tx,
        args.organizationId,
      );
    const out: Array<{
      id: string;
      fromStatus: BookingStatus;
      toStatus: BookingStatus;
    }> = [];
    for (const r of rows) {
      const appendInput = appendInputMassOrganizationCancelBooking({
        bookingId: r.id,
        granularStatus: r.status,
        actorUserId: args.actorUserId,
        texts: {
          cancelReason: args.cancelReason,
          cancellationComment: args.cancellationComment,
        },
        masterLeftWorkplace: false,
      });
      const { previousStatus, projection } =
        await this.bookingAppend.appendBookingEvent(tx, appendInput);
      out.push({
        id: r.id,
        fromStatus: previousStatus,
        toStatus: projection.status,
      });
    }
    return out;
  }

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
    await this.organizationAccess.assertCan(
      userId,
      organizationId,
      OrganizationCapabilities.DELETE,
      { type: 'Organization', organizationId },
    );
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
        await this.massCancelAllActiveBookingsAtOrganizationTx(tx, {
          organizationId,
          actorUserId: userId,
          cancelReason: BOOKING_CANCEL_REASON_ORGANIZATION_DELETED_EN,
          cancellationComment: null,
        });
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
      await tx.organizationOffering.updateMany({
        where: { organizationId, deletedAt: null },
        data: {
          deletedAt: now,
          publicationStatus: OfferingPublicationStatus.archived,
        },
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
    await this.organizationAccess.assertCan(
      userId,
      organizationId,
      OrganizationCapabilities.JOIN_REQUESTS_REVIEW,
      { type: 'Organization', organizationId },
    );
  }

  /** Владелец записи `Organization` или активное employment в точке. */
  private async assertUserEmployedAtOrganization(
    userId: string,
    organizationId: string,
  ): Promise<void> {
    await this.organizationAccess.assertCan(
      userId,
      organizationId,
      OrganizationCapabilities.TEAM_VIEW,
      { type: 'Organization', organizationId },
    );
  }

  /**
   * Участники точки (активное employment): специалист, отображаемое имя, роль в организации.
   * Доступ любому члену точки (см. {@link assertUserEmployedAtOrganization}).
   */
  async listCabinetOrganizationTeamMembers(
    userId: string,
    organizationId: string,
  ): Promise<{
    permissions: OrganizationScopedPermissions;
    members: Array<{
      employmentId: string;
      specialistId: string;
      displayName: string | null;
      role: OrganizationMembershipRole;
      permissions: { manageRole: boolean; remove: boolean };
    }>;
  }> {
    const ctx = await this.organizationAccess.assertCan(
      userId,
      organizationId,
      OrganizationCapabilities.TEAM_VIEW,
      { type: 'Organization', organizationId },
    );
    const permissions = this.organizationAccess.buildPermissionsForContext(ctx);
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { ownerUserId: true },
    });
    const rows = await this.prisma.specialistOrganizationEmployment.findMany({
      where: { organizationId, isActive: true },
      select: {
        id: true,
        specialistId: true,
        role: true,
        specialist: {
          select: {
            listingName: true,
            user: { select: { id: true, name: true } },
          },
        },
      },
    });
    const roleRank = (r: OrganizationMembershipRole): number => {
      if (r === OrganizationMembershipRole.owner) {
        return 0;
      }
      if (r === OrganizationMembershipRole.admin) {
        return 1;
      }
      return 2;
    };
    const members = rows
      .map((r) => ({
        employmentId: r.id,
        specialistId: r.specialistId,
        role: r.role,
        displayName:
          r.specialist.listingName?.trim() ||
          r.specialist.user?.name?.trim() ||
          null,
        permissions: {
          manageRole:
            permissions.team.manageRoles &&
            r.specialist.user?.id !== org?.ownerUserId,
          remove:
            permissions.team.removeMembers &&
            r.specialist.user?.id !== org?.ownerUserId,
        },
      }))
      .sort((a, b) => {
        const rd = roleRank(a.role) - roleRank(b.role);
        if (rd !== 0) {
          return rd;
        }
        const an = (a.displayName ?? a.specialistId).toLowerCase();
        const bn = (b.displayName ?? b.specialistId).toLowerCase();
        return an.localeCompare(bn);
      });
    return { permissions, members };
  }

  async patchCabinetOrganizationTeamMemberRole(
    userId: string,
    organizationId: string,
    employmentId: string,
    body: OrganizationTeamRoleBody,
  ): Promise<{ ok: true }> {
    await this.prisma.$transaction(async (tx) => {
      const ctx = await this.organizationAccess.resolveContextTx(
        tx,
        userId,
        organizationId,
      );
      assertCanOrganization(ctx, OrganizationCapabilities.TEAM_MANAGE_ROLES, {
        type: 'Organization',
        organizationId,
      });

      const target = await tx.specialistOrganizationEmployment.findFirst({
        where: { id: employmentId, organizationId, isActive: true },
        select: {
          id: true,
          role: true,
          specialist: { select: { userId: true } },
          organization: { select: { ownerUserId: true } },
        },
      });
      if (target == null) {
        throw new NotFoundException({
          code: 'ORGANIZATION_TEAM_MEMBER_NOT_FOUND',
          message: 'Organization team member not found',
        });
      }
      if (target.specialist.userId === target.organization.ownerUserId) {
        throw new ForbiddenException({
          code: 'ORGANIZATION_OWNER_ROLE_IMMUTABLE',
          message:
            'Organization owner role cannot be changed from team management',
        });
      }

      await tx.specialistOrganizationEmployment.update({
        where: { id: target.id },
        data: {
          role:
            body.role === 'admin'
              ? OrganizationMembershipRole.admin
              : OrganizationMembershipRole.specialist,
        },
      });
    });
    return { ok: true };
  }

  async deleteCabinetOrganizationTeamMember(
    userId: string,
    organizationId: string,
    employmentId: string,
  ): Promise<{ ok: true }> {
    await this.prisma.$transaction(async (tx) => {
      const ctx = await this.organizationAccess.resolveContextTx(
        tx,
        userId,
        organizationId,
      );
      assertCanOrganization(ctx, OrganizationCapabilities.TEAM_MANAGE_ROLES, {
        type: 'Organization',
        organizationId,
      });

      const target = await tx.specialistOrganizationEmployment.findFirst({
        where: { id: employmentId, organizationId, isActive: true },
        select: {
          id: true,
          specialistId: true,
          specialist: { select: { userId: true, activeOrganizationId: true } },
          organization: { select: { ownerUserId: true } },
        },
      });
      if (target == null) {
        throw new NotFoundException({
          code: 'ORGANIZATION_TEAM_MEMBER_NOT_FOUND',
          message: 'Organization team member not found',
        });
      }
      if (target.specialist.userId === target.organization.ownerUserId) {
        throw new ForbiddenException({
          code: 'ORGANIZATION_OWNER_MEMBERSHIP_IMMUTABLE',
          message: 'Organization owner cannot be removed from team management',
        });
      }

      await tx.specialistOrganizationEmployment.update({
        where: { id: target.id },
        data: { isActive: false, endDate: new Date() },
      });
      if (target.specialist.activeOrganizationId === organizationId) {
        await tx.specialist.update({
          where: { id: target.specialistId },
          data: { activeOrganizationId: null },
        });
        await this.syncSpecialistListedInDirectory(tx, target.specialistId);
      }
    });
    return { ok: true };
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
    const pending = await this.prisma.specialistWorkplaceJoinRequest.findFirst({
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
        message: 'Pending workplace join request not found for this specialist',
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
      await this.specialistOfferingEdgeLifecycle.reconcileAssignmentsForSpecialist(
        joinRow.specialistId,
      );
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

  /**
   * Slug'и больших категорий из тела запроса → упорядоченные id для БД.
   * Пустой список допустим: у организации нет выбранных сфер деятельности.
   */
  private async resolveMajorCategoriesFromBodySlugs(
    slugs: string[] | undefined,
  ): Promise<{ majorCategoryIds: string[]; majorCategorySlugs: string[] }> {
    const uniqInput = [
      ...new Set((slugs ?? []).map((s) => s.trim().toLowerCase())),
    ].filter((s) => s.length > 0);
    if (uniqInput.length === 0) {
      return { majorCategoryIds: [], majorCategorySlugs: [] };
    }
    const rows = await this.prisma.majorServiceCategory.findMany({
      where: {
        slug: { in: uniqInput },
        deletedAt: null,
        isActive: true,
      },
      select: { id: true, slug: true, sortOrder: true },
    });
    if (rows.length !== uniqInput.length) {
      throw new BadRequestException({
        code: 'INVALID_MAJOR_CATEGORY_SLUGS',
        message: 'One or more major category slugs are invalid or inactive',
      });
    }
    const bySlug = new Map(rows.map((r) => [r.slug, r] as const));
    const ordered = uniqInput
      .map((slug) => bySlug.get(slug)!)
      .sort(
        (a, b) =>
          a.sortOrder - b.sortOrder ||
          a.slug.localeCompare(b.slug, undefined, { sensitivity: 'base' }),
      );
    return {
      majorCategoryIds: ordered.map((r) => r.id),
      majorCategorySlugs: ordered.map((r) => r.slug),
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
    if (
      specialist.onboardingWorkPattern === SpecialistWorkPattern.employed_salon
    ) {
      throw new ConflictException({
        code: 'ORGANIZATION_CREATE_FORBIDDEN_EMPLOYED_SALON_PATTERN',
        message:
          'Создание своей организации недоступно при выборе «работаю в салоне».',
      });
    }
    const organizationType = body.organizationType;
    if (
      specialist.onboardingWorkPattern === SpecialistWorkPattern.solo &&
      organizationType !== OrganizationType.solo
    ) {
      throw new ConflictException({
        code: 'ORGANIZATION_TYPE_MISMATCH_WORK_PATTERN',
        message:
          'Для режима «на себя» тип организации в запросе должен быть solo.',
      });
    }
    if (
      specialist.onboardingWorkPattern === SpecialistWorkPattern.business &&
      organizationType !== OrganizationType.business
    ) {
      throw new ConflictException({
        code: 'ORGANIZATION_TYPE_MISMATCH_WORK_PATTERN',
        message:
          'Для режима «свой салон» тип организации в запросе должен быть business.',
      });
    }
    const hadActiveWorkplace = specialist.activeOrganizationId != null;
    const majors = await this.resolveMajorCategoriesFromBodySlugs(
      body.majorCategorySlugs,
    );
    await this.assertServiceCategoriesBelongToOrganizationMajors(
      body.serviceCategoryIds,
      majors.majorCategoryIds,
    );

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
          organizationType,
          description: norm(body.description),
          phone: norm(body.phone),
          email: norm(body.email),
          website: norm(body.website),
          addressId: addr.id,
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
          ...(body.serviceCategoryIds.length > 0
            ? {
                serviceCategories: {
                  create: body.serviceCategoryIds.map((serviceCategoryId) => ({
                    serviceCategoryId,
                  })),
                },
              }
            : {}),
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

      if (majors.majorCategoryIds.length > 0) {
        await tx.organizationMajorServiceCategory.createMany({
          data: majors.majorCategoryIds.map((majorServiceCategoryId) => ({
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

      await syncOrganizationServiceCategoriesFromPublishedOfferings(tx, orgId);

      /** Снимок онбординговых сфер удаляем в SpecialistOnboardingService.complete — до finish клиент может объединить их с сферами организации для каталога услуг. */
    });

    await this.moderationEnqueue.enqueueOrganizationProfileModeration(
      profileRevisionId,
    );

    await this.specialistOfferingEdgeLifecycle.reconcileAssignmentsForSpecialist(
      specialist.id,
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
        majorServiceCategories: {
          include: {
            majorServiceCategory: {
              select: { id: true, slug: true, sortOrder: true },
            },
          },
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

    const { slugs: majorCategorySlugs } =
      mergeOrganizationMajorIdsAndSlugsFromDb(org);

    return {
      majorCategorySlugs,
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
    const majors = await this.resolveMajorCategoriesFromBodySlugs(
      body.majorCategorySlugs,
    );
    await this.assertServiceCategoriesBelongToOrganizationMajors(
      body.serviceCategoryIds,
      majors.majorCategoryIds,
    );

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
        select: { id: true },
      });
      if (!head) {
        throw new NotFoundException({
          code: 'ORGANIZATION_NOT_FOUND',
          message: 'Organization not found',
        });
      }
      await tx.organizationMajorServiceCategory.deleteMany({
        where: { organizationId },
      });
      if (majors.majorCategoryIds.length > 0) {
        await tx.organizationMajorServiceCategory.createMany({
          data: majors.majorCategoryIds.map((majorServiceCategoryId) => ({
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
          ...(body.serviceCategoryIds.length > 0
            ? {
                serviceCategories: {
                  create: body.serviceCategoryIds.map((serviceCategoryId) => ({
                    serviceCategoryId,
                  })),
                },
              }
            : {}),
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

      await syncOrganizationServiceCategoriesFromPublishedOfferings(
        tx,
        organizationId,
      );
    });

    await this.moderationEnqueue.enqueueOrganizationProfileModeration(
      profileRevisionId,
    );

    return this.specialistOnboarding.getOnboarding(userId);
  }
}
