import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BOOKING_AUTO_CANCEL_MASTER_LEFT_WORKPLACE_EN } from '../../bookings/domain/booking-cancel-reason';
import { appendInputMassOrganizationCancelBooking } from '../../bookings/domain/booking-mass-organization-cancel';
import { BookingAppendService } from '../../bookings/application/booking-append.service';
import { BookingStatusLocaleRepository } from '../../bookings/infrastructure/booking-status-locale.repository';
import { BookingsRepository } from '../../bookings/infrastructure/bookings.repository';
import type { BookingStatus, Prisma } from '@prisma/client';
import {
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
import { computeListedInDirectory } from '../domain/specialist-directory-flags';
import { SpecialistOfferingEdgeLifecycleService } from '../../directory/application/specialist-offering-edge-lifecycle.service';

@Injectable()
export class SpecialistWorkplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsRepository: BookingsRepository,
    private readonly bookingAppend: BookingAppendService,
    private readonly bookingStatusLocaleRepository: BookingStatusLocaleRepository,
    private readonly pushNotifications: PushNotificationsService,
    private readonly specialistOfferingEdgeLifecycle: SpecialistOfferingEdgeLifecycleService,
  ) {}

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
      select: { id: true, activeOrganizationId: true },
    });
    if (!specialist) {
      return { organizations: [], activeOrganizationId: null };
    }
    const employments =
      await this.prisma.specialistOrganizationEmployment.findMany({
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
      });
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

    return {
      organizations: [
        ...employments.map((e) => {
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
          return {
            id: e.organization.id,
            name: e.organization.name,
            membershipStatus: 'employed' as const,
            workplaceJoinRequestId: null,
            role: e.role,
            isActiveWorkplace:
              specialist.activeOrganizationId === e.organization.id,
            publicationModerationStatus:
              pending != null
                ? PublicationModerationStatus.pending_review
                : e.organization.publicationModerationStatus,
            salonCabinetPreview,
            publishedCoverImageUrl:
              publishedCoverUrlByOrgId.get(e.organization.id) ?? null,
          };
        }),
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

  /**
   * Превью активных броней с вами как мастером на текущем месте приёма —
   * то же множество, что будет отменено при смене активной организации.
   */
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
      select: { id: true, activeOrganizationId: true },
    });
    if (!specialist) {
      throw new NotFoundException({
        code: 'SPECIALIST_PROFILE_NOT_FOUND',
        message: 'Specialist profile not found for this user',
      });
    }

    if (specialist.activeOrganizationId !== organizationIdFromQuery) {
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
      select: { id: true, activeOrganizationId: true },
    });
    if (!specialist) {
      throw new NotFoundException({
        code: 'SPECIALIST_PROFILE_NOT_FOUND',
        message: 'Specialist profile not found for this user',
      });
    }

    if (body.organizationId === null) {
      const previousOrgId = specialist.activeOrganizationId;
      if (previousOrgId == null) {
        return {
          activeOrganizationId: null,
          cancelledBookingsCount: 0,
        };
      }

      const cancelled = await this.prisma.$transaction(async (tx) => {
        await tx.specialist.update({
          where: { id: specialist.id },
          data: { activeOrganizationId: null },
        });
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
        return this.massCancelBookingsAtSpecialistOrganizationTx(tx, {
          specialistId: specialist.id,
          organizationId: previousOrgId,
          actorUserId: userId,
          cancelReason: BOOKING_AUTO_CANCEL_MASTER_LEFT_WORKPLACE_EN,
          cancellationComment: null,
        });
      });
      for (const row of cancelled) {
        void this.pushNotifications.notifyClientBookingStatusChange(
          row.id,
          row.fromStatus,
          row.toStatus,
        );
      }
      await this.specialistOfferingEdgeLifecycle.reconcileAssignmentsForSpecialist(
        specialist.id,
      );
      return {
        activeOrganizationId: null,
        cancelledBookingsCount: cancelled.length,
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
          'You are not an active member of this organization; cannot set it as workplace',
      });
    }

    const previousOrgId = specialist.activeOrganizationId;
    if (previousOrgId === body.organizationId) {
      return {
        activeOrganizationId: body.organizationId,
        cancelledBookingsCount: 0,
      };
    }

    const cancelled = await this.prisma.$transaction(async (tx) => {
      await tx.specialist.update({
        where: { id: specialist.id },
        data: { activeOrganizationId: body.organizationId },
      });
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
      if (!previousOrgId) {
        return [];
      }
      return this.massCancelBookingsAtSpecialistOrganizationTx(tx, {
        specialistId: specialist.id,
        organizationId: previousOrgId,
        actorUserId: userId,
        cancelReason: BOOKING_AUTO_CANCEL_MASTER_LEFT_WORKPLACE_EN,
        cancellationComment: null,
      });
    });
    for (const row of cancelled) {
      void this.pushNotifications.notifyClientBookingStatusChange(
        row.id,
        row.fromStatus,
        row.toStatus,
      );
    }

    await this.specialistOfferingEdgeLifecycle.reconcileAssignmentsForSpecialist(
      specialist.id,
    );

    return {
      activeOrganizationId: body.organizationId,
      cancelledBookingsCount: cancelled.length,
    };
  }
}
