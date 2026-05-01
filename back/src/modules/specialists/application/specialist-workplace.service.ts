import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BOOKING_AUTO_CANCEL_MASTER_LEFT_WORKPLACE_EN } from '../../bookings/domain/booking-cancel-reason';
import { BookingStatusLocaleRepository } from '../../bookings/infrastructure/booking-status-locale.repository';
import { BookingsRepository } from '../../bookings/infrastructure/bookings.repository';
import {
  GalleryMediaKind,
  GalleryOwnerKind,
  OrganizationProfileRevisionStatus,
  PublicationModerationStatus,
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
import { syncOrganizationServiceCategoriesFromSpecialistServices } from '../../organizations/infrastructure/organization-service-category-sync';

@Injectable()
export class SpecialistWorkplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsRepository: BookingsRepository,
    private readonly bookingStatusLocaleRepository: BookingStatusLocaleRepository,
    private readonly pushNotifications: PushNotificationsService,
  ) {}

  /**
   * Активные членства мастера в организациях (текущие места работы в истории трудоустройства).
   */
  async listMyOrganizations(userId: string): Promise<{
    organizations: Array<{
      id: string;
      name: string;
      role: string;
      isActiveWorkplace: boolean;
      publicationModerationStatus: PublicationModerationStatus;
      /** Черновик на модерации: превью для кабинета (гость в каталоге ещё по опубликованной строке). */
      salonCabinetPreview: {
        revisionId: string;
        name: string;
        coverImageUrl: string | null;
      } | null;
      /**
       * Обложка опубликованной витрины (галерея организации). Если есть `salonCabinetPreview`, карточку
       * кабинета лучше собирать из превью; это поле нужно, когда pending-ревизии нет.
       */
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
    const orgIds = [...new Set(employments.map((x) => x.organization.id))];
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
      organizations: employments.map((e) => {
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
          role: e.role,
          isActiveWorkplace:
            specialist.activeOrganizationId === e.organization.id,
          publicationModerationStatus:
            e.organization.publicationModerationStatus,
          salonCabinetPreview,
          publishedCoverImageUrl:
            publishedCoverUrlByOrgId.get(e.organization.id) ?? null,
        };
      }),
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
  ): Promise<{ activeOrganizationId: string | null; cancelledBookingsCount: number }> {
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
        return this.bookingsRepository.cancelActiveBookingsAtOrganization(tx, {
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
      await syncOrganizationServiceCategoriesFromSpecialistServices(
        this.prisma,
        previousOrgId,
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
        return [] as Awaited<
          ReturnType<BookingsRepository['cancelActiveBookingsAtOrganization']>
        >;
      }
      return this.bookingsRepository.cancelActiveBookingsAtOrganization(tx, {
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

    await syncOrganizationServiceCategoriesFromSpecialistServices(
      this.prisma,
      body.organizationId,
    );

    return {
      activeOrganizationId: body.organizationId,
      cancelledBookingsCount: cancelled.length,
    };
  }
}
