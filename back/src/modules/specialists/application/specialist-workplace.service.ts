import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { appendInputMassOrganizationCancelBooking } from '../../bookings/domain/booking-mass-organization-cancel';
import { BookingAppendService } from '../../bookings/application/booking-append.service';
import { BookingStatusLocaleRepository } from '../../bookings/infrastructure/booking-status-locale.repository';
import { BookingsRepository } from '../../bookings/infrastructure/bookings.repository';
import type { BookingStatus, Prisma } from '@prisma/client';
import {
  CalendarResourceType,
  GalleryMediaKind,
  GalleryOwnerKind,
  OrganizationProfileRevisionStatus,
  PublicationModerationStatus,
  SpecialistWorkplaceJoinRequestStatus,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  buildBookingStatusLabelMap,
  parseApiLocale,
  pickBookingStatusLabel,
  type ApiLocale,
} from '../../../common/i18n';
import { PushNotificationsService } from '../../notifications/application/push-notifications.service';
import type { PatchSpecialistActiveOrganizationBody } from '../dto/patch-specialist-active-organization-body.schema';
import { SpecialistOfferingEdgeLifecycleService } from '../../directory/application/specialist-offering-edge-lifecycle.service';
import { CalendarService } from '../../calendar/application/calendar.service';
import { OrganizationAccessPolicyService } from '../../organizations/application/organization-access-policy.service';
import {
  emptyOrganizationPermissions,
  type OrganizationScopedPermissions,
} from '../../organizations/domain/organization-permissions';
import type {
  CreateSpecialistWorkplaceBody,
  PatchSpecialistProfileStateBody,
  PatchSpecialistWorkplaceBody,
} from '../dto/specialist-workplace.schema';
import { recomputeListedInDirectoryTx } from './recompute-specialist-listed-in-directory';

const ACTIVE_BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'in_progress',
] as const;

@Injectable()
export class SpecialistWorkplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsRepository: BookingsRepository,
    private readonly bookingAppend: BookingAppendService,
    private readonly bookingStatusLocaleRepository: BookingStatusLocaleRepository,
    private readonly pushNotifications: PushNotificationsService,
    private readonly specialistOfferingEdgeLifecycle: SpecialistOfferingEdgeLifecycleService,
    private readonly calendarService: CalendarService,
    private readonly organizationAccess: OrganizationAccessPolicyService,
  ) {}

  private async assertHasActiveEmployment(
    tx: Prisma.TransactionClient,
    specialistId: string,
    organizationId: string,
  ): Promise<void> {
    const employment = await tx.specialistOrganizationEmployment.findFirst({
      where: { specialistId, organizationId, isActive: true },
      select: { id: true },
    });
    if (employment == null) {
      throw new BadRequestException({
        code: 'WORKPLACE_REQUIRES_ACTIVE_EMPLOYMENT',
        message:
          'Specialist must have active employment in the organization before adding it as a workplace',
      });
    }
  }

  private async assertCanDeactivateWorkplaceTx(
    tx: Prisma.TransactionClient,
    workplace: {
      id: string;
      specialistId: string;
      isActive: boolean;
    },
  ): Promise<void> {
    await this.assertWorkplaceHasNoActiveBookingsTx(tx, workplace.id);
  }

  private async assertWorkplaceHasNoActiveBookingsTx(
    tx: Prisma.TransactionClient,
    workplaceId: string,
  ): Promise<void> {
    const activeBookingsCount = await tx.booking.count({
      where: {
        workplaceId,
        deletedAt: null,
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
      },
    });
    if (activeBookingsCount > 0) {
      throw new ConflictException({
        code: 'CANNOT_DEACTIVATE_WORKPLACE_WITH_ACTIVE_BOOKINGS',
        message: 'Cannot deactivate workplace while it has active bookings',
      });
    }
  }

  private async activateWorkplaceTx(
    tx: Prisma.TransactionClient,
    workplace: {
      id: string;
      specialistId: string;
      organizationId: string;
    },
  ): Promise<void> {
    await this.assertHasActiveEmployment(
      tx,
      workplace.specialistId,
      workplace.organizationId,
    );
    const currentActiveWorkplaces = await tx.specialistWorkplace.findMany({
      where: {
        specialistId: workplace.specialistId,
        isActive: true,
        deletedAt: null,
        NOT: { id: workplace.id },
      },
      select: { id: true },
    });
    for (const current of currentActiveWorkplaces) {
      await this.assertWorkplaceHasNoActiveBookingsTx(tx, current.id);
    }
    await tx.specialistWorkplace.updateMany({
      where: {
        specialistId: workplace.specialistId,
        isActive: true,
        deletedAt: null,
      },
      data: { isActive: false },
    });
    await tx.calendarResource.updateMany({
      where: {
        specialistId: workplace.specialistId,
        type: CalendarResourceType.specialist,
        deletedAt: null,
        NOT: { organizationId: workplace.organizationId },
      },
      data: { isActive: false },
    });
    await tx.specialistWorkplace.update({
      where: { id: workplace.id },
      data: { isActive: true, deletedAt: null },
    });
    await this.calendarService.ensureSpecialistResourceForOrganizationTx(tx, {
      organizationId: workplace.organizationId,
      specialistId: workplace.specialistId,
    });
    await recomputeListedInDirectoryTx(tx, workplace.specialistId);
  }

  private mapUniqueActiveWorkplaceConflict(e: unknown): never {
    if ((e as { code?: string }).code === 'P2002') {
      throw new ConflictException({
        code: 'ANOTHER_WORKPLACE_ALREADY_ACTIVE',
        message: 'Another workplace is already active; refresh and try again',
      });
    }
    throw e;
  }

  /**
   * Активные брони мастера в организации перед сменой места приёма: append событий массовой отмены.
   */
  private async massCancelBookingsAtSpecialistOrganizationTx(
    tx: Prisma.TransactionClient,
    args: {
      specialistId: string;
      organizationId: string;
      actorUserId: string;
      cancelReason: string;
      cancellationComment: string | null;
    },
  ): Promise<
    Array<{ id: string; fromStatus: BookingStatus; toStatus: BookingStatus }>
  > {
    const rows =
      await this.bookingsRepository.findActiveMinimalForSpecialistOrganization(
        tx,
        {
          specialistId: args.specialistId,
          organizationId: args.organizationId,
        },
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
        masterLeftWorkplace: true,
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

  /**
   * Организации мастера: активные членства и салоны, по которым висит заявка на вступление (pending).
   */
  async listMyOrganizations(userId: string): Promise<{
    organizations: Array<{
      id: string;
      name: string;
      membershipStatus: 'employed' | 'pending_join';
      workplaceJoinRequestId: string | null;
      role: string | null;
      permissions: OrganizationScopedPermissions;
      isActiveWorkplace: boolean;
      publicationModerationStatus: PublicationModerationStatus;
      salonCabinetPreview: {
        revisionId: string;
        name: string;
        coverImageUrl: string | null;
      } | null;
      publishedCoverImageUrl: string | null;
    }>;
    activeOrganizationId: string | null;
  }> {
    const specialist = await this.prisma.specialist.findFirst({
      where: { userId, deletedAt: null },
      select: {
        id: true,
        activeOrganizationId: true,
      },
    });
    if (!specialist) {
      return { organizations: [], activeOrganizationId: null };
    }
    const [employments, activeWorkplaces] = await Promise.all([
      this.prisma.specialistOrganizationEmployment.findMany({
        where: { specialistId: specialist.id, isActive: true },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              publicationModerationStatus: true,
            },
          },
        },
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.specialistWorkplace.findMany({
        where: {
          specialistId: specialist.id,
          isActive: true,
          deletedAt: null,
        },
        select: { organizationId: true },
      }),
    ]);
    const activeWorkplaceOrgIds = new Set(
      activeWorkplaces.map((w) => w.organizationId),
    );
    const employedOrgIds = [
      ...new Set(employments.map((x) => x.organization.id)),
    ];
    const pendingJoinRowsRaw =
      await this.prisma.specialistWorkplaceJoinRequest.findMany({
        where: {
          specialistId: specialist.id,
          status: SpecialistWorkplaceJoinRequestStatus.pending,
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              publicationModerationStatus: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });
    const employedOrgIdSet = new Set(employedOrgIds);
    const pendingJoinRows = pendingJoinRowsRaw.filter(
      (row) => !employedOrgIdSet.has(row.organizationId),
    );
    const orgIds = [
      ...new Set([
        ...employedOrgIds,
        ...pendingJoinRows.map((r) => r.organizationId),
      ]),
    ];
    const latestPendingByOrgId = new Map<
      string,
      { revisionId: string; name: string }
    >();
    if (orgIds.length > 0) {
      const pendingRows =
        await this.prisma.organizationProfileRevision.findMany({
          where: {
            organizationId: { in: orgIds },
            status: OrganizationProfileRevisionStatus.pending_review,
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            organizationId: true,
            name: true,
          },
        });
      for (const row of pendingRows) {
        if (!latestPendingByOrgId.has(row.organizationId)) {
          latestPendingByOrgId.set(row.organizationId, {
            revisionId: row.id,
            name: row.name,
          });
        }
      }
    }

    const revisionIdsWithPreview = [...latestPendingByOrgId.values()].map(
      (v) => v.revisionId,
    );
    const publishedCoverUrlByOrgId = new Map<string, string>();
    if (orgIds.length > 0) {
      const orgGalleries = await this.prisma.gallery.findMany({
        where: {
          ownerKind: GalleryOwnerKind.organization,
          ownerId: { in: orgIds },
        },
        select: {
          ownerId: true,
          items: {
            where: { kind: GalleryMediaKind.image },
            orderBy: { sortOrder: 'asc' },
            take: 1,
            select: { url: true },
          },
        },
      });
      for (const g of orgGalleries) {
        const first = g.items[0]?.url?.trim();
        if (first) {
          publishedCoverUrlByOrgId.set(g.ownerId, first);
        }
      }
    }
    const coverUrlByRevisionId = new Map<string, string>();
    if (revisionIdsWithPreview.length > 0) {
      const galleries = await this.prisma.gallery.findMany({
        where: {
          ownerKind: GalleryOwnerKind.organization_profile_revision,
          ownerId: { in: revisionIdsWithPreview },
        },
        select: {
          ownerId: true,
          items: {
            where: { kind: GalleryMediaKind.image },
            orderBy: { sortOrder: 'asc' },
            take: 1,
            select: { url: true },
          },
        },
      });
      for (const g of galleries) {
        const first = g.items[0]?.url?.trim();
        if (first) {
          coverUrlByRevisionId.set(g.ownerId, first);
        }
      }
    }

    const accessCache = this.organizationAccess.createContextCache();
    const employedRows = await Promise.all(
      employments.map(async (e) => {
        const pending = latestPendingByOrgId.get(e.organization.id);
        const salonCabinetPreview =
          pending != null
            ? {
                revisionId: pending.revisionId,
                name: pending.name,
                coverImageUrl:
                  coverUrlByRevisionId.get(pending.revisionId) ?? null,
              }
            : null;
        const ctx = await accessCache.resolve(userId, e.organization.id);
        return {
          id: e.organization.id,
          name: e.organization.name,
          membershipStatus: 'employed' as const,
          workplaceJoinRequestId: null,
          role: e.role,
          permissions: this.organizationAccess.buildPermissionsForContext(ctx),
          isActiveWorkplace: activeWorkplaceOrgIds.has(e.organization.id),
          publicationModerationStatus:
            pending != null
              ? PublicationModerationStatus.pending_review
              : e.organization.publicationModerationStatus,
          salonCabinetPreview,
          publishedCoverImageUrl:
            publishedCoverUrlByOrgId.get(e.organization.id) ?? null,
        };
      }),
    );

    return {
      organizations: [
        ...employedRows,
        ...pendingJoinRows.map((row) => {
          const org = row.organization;
          const pendingRev = latestPendingByOrgId.get(org.id);
          const salonCabinetPreview =
            pendingRev != null
              ? {
                  revisionId: pendingRev.revisionId,
                  name: pendingRev.name,
                  coverImageUrl:
                    coverUrlByRevisionId.get(pendingRev.revisionId) ?? null,
                }
              : null;
          return {
            id: org.id,
            name: org.name,
            membershipStatus: 'pending_join' as const,
            workplaceJoinRequestId: row.id,
            role: null,
            permissions: emptyOrganizationPermissions(),
            isActiveWorkplace: false,
            publicationModerationStatus:
              pendingRev != null
                ? PublicationModerationStatus.pending_review
                : org.publicationModerationStatus,
            salonCabinetPreview,
            publishedCoverImageUrl:
              publishedCoverUrlByOrgId.get(org.id) ?? null,
          };
        }),
      ],
      activeOrganizationId: specialist.activeOrganizationId,
    };
  }

  async getMyWorkplaces(userId: string): Promise<{
    profile: { isActive: boolean };
    workplaces: Array<{
      id: string;
      organizationId: string;
      organizationName: string;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }> {
    const specialist = await this.prisma.specialist.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    if (!specialist) {
      throw new NotFoundException({
        code: 'SPECIALIST_PROFILE_NOT_FOUND',
        message: 'Specialist profile not found for this user',
      });
    }
    const [, workplaces] = await Promise.all([
      this.prisma.$transaction(async (tx) => {
        await tx.specialistProfile.upsert({
          where: { specialistId: specialist.id },
          create: { specialistId: specialist.id, isActive: true },
          update: { isActive: true },
          select: { specialistId: true },
        });
        return recomputeListedInDirectoryTx(tx, specialist.id);
      }),
      this.prisma.specialistWorkplace.findMany({
        where: { specialistId: specialist.id, deletedAt: null },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
        include: { organization: { select: { name: true } } },
      }),
    ]);
    return {
      profile: { isActive: true },
      workplaces: workplaces.map((w) => ({
        id: w.id,
        organizationId: w.organizationId,
        organizationName: w.organization.name,
        isActive: w.isActive,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      })),
    };
  }

  async createWorkplace(
    userId: string,
    body: CreateSpecialistWorkplaceBody,
  ): Promise<{ id: string; organizationId: string; isActive: boolean }> {
    const specialist = await this.prisma.specialist.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    if (!specialist) {
      throw new NotFoundException({
        code: 'SPECIALIST_PROFILE_NOT_FOUND',
        message: 'Specialist profile not found for this user',
      });
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.assertHasActiveEmployment(
          tx,
          specialist.id,
          body.organizationId,
        );
        const activeWorkplacesCount = await tx.specialistWorkplace.count({
          where: {
            specialistId: specialist.id,
            isActive: true,
            deletedAt: null,
          },
        });
        const row = await tx.specialistWorkplace.upsert({
          where: {
            specialistId_organizationId: {
              specialistId: specialist.id,
              organizationId: body.organizationId,
            },
          },
          create: {
            specialistId: specialist.id,
            organizationId: body.organizationId,
            isActive: activeWorkplacesCount === 0,
          },
          update: { deletedAt: null },
          select: { id: true, organizationId: true, isActive: true },
        });
        if (activeWorkplacesCount === 0 && !row.isActive) {
          await this.activateWorkplaceTx(tx, {
            id: row.id,
            specialistId: specialist.id,
            organizationId: row.organizationId,
          });
        } else {
          await recomputeListedInDirectoryTx(tx, specialist.id);
        }
        const fresh = await tx.specialistWorkplace.findUniqueOrThrow({
          where: { id: row.id },
          select: { id: true, organizationId: true, isActive: true },
        });
        return fresh;
      });
    } catch (e: unknown) {
      this.mapUniqueActiveWorkplaceConflict(e);
    }
  }

  async activateWorkplace(
    userId: string,
    workplaceId: string,
  ): Promise<{ id: string; organizationId: string; isActive: boolean }> {
    const workplace = await this.prisma.specialistWorkplace.findFirst({
      where: {
        id: workplaceId,
        deletedAt: null,
        specialist: { userId, deletedAt: null },
      },
      select: { id: true, specialistId: true, organizationId: true },
    });
    if (!workplace) {
      throw new NotFoundException({
        code: 'WORKPLACE_NOT_FOUND',
        message: 'Workplace not found',
      });
    }
    try {
      await this.prisma.$transaction((tx) =>
        this.activateWorkplaceTx(tx, workplace),
      );
    } catch (e: unknown) {
      this.mapUniqueActiveWorkplaceConflict(e);
    }
    await this.specialistOfferingEdgeLifecycle.reconcileAssignmentsForSpecialist(
      workplace.specialistId,
    );
    return this.prisma.specialistWorkplace.findUniqueOrThrow({
      where: { id: workplace.id },
      select: { id: true, organizationId: true, isActive: true },
    });
  }

  async patchWorkplace(
    userId: string,
    workplaceId: string,
    body: PatchSpecialistWorkplaceBody,
  ): Promise<{ id: string; organizationId: string; isActive: boolean }> {
    if (body.isActive === true) {
      return this.activateWorkplace(userId, workplaceId);
    }
    if (body.isActive === false) {
      return this.deactivateWorkplace(userId, workplaceId);
    }
    const workplace = await this.prisma.specialistWorkplace.findFirst({
      where: {
        id: workplaceId,
        deletedAt: null,
        specialist: { userId, deletedAt: null },
      },
      select: { id: true, organizationId: true, isActive: true },
    });
    if (!workplace) {
      throw new NotFoundException({
        code: 'WORKPLACE_NOT_FOUND',
        message: 'Workplace not found',
      });
    }
    return workplace;
  }

  async deactivateWorkplace(
    userId: string,
    workplaceId: string,
  ): Promise<{ id: string; organizationId: string; isActive: boolean }> {
    const workplace = await this.prisma.specialistWorkplace.findFirst({
      where: {
        id: workplaceId,
        deletedAt: null,
        specialist: { userId, deletedAt: null },
      },
      select: {
        id: true,
        specialistId: true,
        organizationId: true,
        isActive: true,
      },
    });
    if (!workplace) {
      throw new NotFoundException({
        code: 'WORKPLACE_NOT_FOUND',
        message: 'Workplace not found',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await this.assertCanDeactivateWorkplaceTx(tx, workplace);
      await tx.specialistWorkplace.update({
        where: { id: workplace.id },
        data: { isActive: false },
      });
      await tx.calendarResource.updateMany({
        where: {
          organizationId: workplace.organizationId,
          specialistId: workplace.specialistId,
          type: CalendarResourceType.specialist,
          deletedAt: null,
        },
        data: { isActive: false },
      });
      await recomputeListedInDirectoryTx(tx, workplace.specialistId);
    });
    return this.prisma.specialistWorkplace.findUniqueOrThrow({
      where: { id: workplace.id },
      select: { id: true, organizationId: true, isActive: true },
    });
  }

  async deleteWorkplace(
    userId: string,
    workplaceId: string,
  ): Promise<{ ok: true }> {
    const workplace = await this.prisma.specialistWorkplace.findFirst({
      where: {
        id: workplaceId,
        deletedAt: null,
        specialist: { userId, deletedAt: null },
      },
      select: {
        id: true,
        specialistId: true,
        organizationId: true,
        isActive: true,
      },
    });
    if (!workplace) {
      throw new NotFoundException({
        code: 'WORKPLACE_NOT_FOUND',
        message: 'Workplace not found',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await this.assertCanDeactivateWorkplaceTx(tx, workplace);
      await tx.specialistWorkplace.update({
        where: { id: workplace.id },
        data: { isActive: false, deletedAt: new Date() },
      });
      await tx.calendarResource.updateMany({
        where: {
          organizationId: workplace.organizationId,
          specialistId: workplace.specialistId,
          type: CalendarResourceType.specialist,
          deletedAt: null,
        },
        data: { isActive: false },
      });
      await recomputeListedInDirectoryTx(tx, workplace.specialistId);
    });
    return { ok: true };
  }

  async patchProfileState(
    userId: string,
    body: PatchSpecialistProfileStateBody,
  ): Promise<{ isActive: boolean; listedInDirectory: boolean }> {
    void body;
    const specialist = await this.prisma.specialist.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    if (!specialist) {
      throw new NotFoundException({
        code: 'SPECIALIST_PROFILE_NOT_FOUND',
        message: 'Specialist profile not found for this user',
      });
    }
    const listedInDirectory = await this.prisma.$transaction(async (tx) => {
      await tx.specialistProfile.upsert({
        where: { specialistId: specialist.id },
        create: { specialistId: specialist.id, isActive: true },
        update: { isActive: true },
      });
      return recomputeListedInDirectoryTx(tx, specialist.id);
    });
    await this.specialistOfferingEdgeLifecycle.reconcileAssignmentsForSpecialist(
      specialist.id,
    );
    return { isActive: true, listedInDirectory };
  }

  /**
   * Заявки мастера на вступление в организации (все статусы, от новых к старым).
   */
  async listMyWorkplaceJoinRequests(userId: string): Promise<{
    requests: Array<{
      id: string;
      organizationId: string;
      status: string;
      createdAt: Date;
      updatedAt: Date;
      resolvedAt: Date | null;
      organization: { id: string; name: string };
    }>;
  }> {
    const specialist = await this.prisma.specialist.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    if (!specialist) {
      return { requests: [] };
    }
    const rows = await this.prisma.specialistWorkplaceJoinRequest.findMany({
      where: { specialistId: specialist.id },
      orderBy: { createdAt: 'desc' },
      include: {
        organization: { select: { id: true, name: true } },
      },
    });
    return {
      requests: rows.map((r) => ({
        id: r.id,
        organizationId: r.organizationId,
        status: r.status,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        resolvedAt: r.resolvedAt,
        organization: r.organization,
      })),
    };
  }

  private async resolveCabinetBookingPreviewLocale(
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

  /** Превью активных броней с вами как мастером на активном месте приёма. */
  async previewBookingsWhenLeavingActiveOrganization(
    userId: string,
    organizationIdFromQuery: string,
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
    }>;
  }> {
    const specialist = await this.prisma.specialist.findFirst({
      where: { userId, deletedAt: null },
      select: {
        id: true,
        workplaces: {
          where: { isActive: true, deletedAt: null },
          select: { organizationId: true },
          take: 1,
        },
      },
    });
    if (!specialist) {
      throw new NotFoundException({
        code: 'SPECIALIST_PROFILE_NOT_FOUND',
        message: 'Specialist profile not found for this user',
      });
    }

    const activeOrganizationId =
      specialist.workplaces[0]?.organizationId ?? null;
    if (activeOrganizationId !== organizationIdFromQuery) {
      throw new BadRequestException({
        code: 'NOT_CURRENT_ACTIVE_WORKPLACE_ORGANIZATION',
        message:
          'Bookings preview is only available for the organization that is your current workplace',
      });
    }

    const locale = await this.resolveCabinetBookingPreviewLocale(
      userId,
      localeFromQuery,
    );

    const [localeRows, rawRows] = await Promise.all([
      this.bookingStatusLocaleRepository.findAll(),
      this.bookingsRepository.findActiveBookingsAtOrganizationForCabinetPreview(
        specialist.id,
        organizationIdFromQuery,
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
      })),
    };
  }

  async setActiveOrganization(
    userId: string,
    body: PatchSpecialistActiveOrganizationBody,
  ): Promise<{
    activeOrganizationId: string | null;
    cancelledBookingsCount: number;
  }> {
    const specialist = await this.prisma.specialist.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    if (!specialist) {
      throw new NotFoundException({
        code: 'SPECIALIST_PROFILE_NOT_FOUND',
        message: 'Specialist profile not found for this user',
      });
    }

    if (body.organizationId === null) {
      await this.prisma.specialist.update({
        where: { id: specialist.id },
        data: { activeOrganizationId: null },
      });
      return {
        activeOrganizationId: null,
        cancelledBookingsCount: 0,
      };
    }

    const org = await this.prisma.organization.findFirst({
      where: { id: body.organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!org) {
      throw new NotFoundException({
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Organization not found',
      });
    }

    const employment =
      await this.prisma.specialistOrganizationEmployment.findFirst({
        where: {
          specialistId: specialist.id,
          organizationId: body.organizationId,
          isActive: true,
        },
      });
    if (!employment) {
      throw new BadRequestException({
        code: 'NOT_EMPLOYED_AT_ORGANIZATION',
        message:
          'You are not an active member of this organization; cannot set it as active organization context',
      });
    }

    await this.prisma.specialist.update({
      where: { id: specialist.id },
      data: { activeOrganizationId: body.organizationId },
    });

    return {
      activeOrganizationId: body.organizationId,
      cancelledBookingsCount: 0,
    };
  }
}
