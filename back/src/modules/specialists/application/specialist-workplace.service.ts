import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BOOKING_AUTO_CANCEL_MASTER_LEFT_WORKPLACE_EN } from '../../bookings/domain/booking-cancel-reason';
import { BookingsRepository } from '../../bookings/infrastructure/bookings.repository';
import { PublicationModerationStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { PushNotificationsService } from '../../notifications/application/push-notifications.service';
import type { PatchSpecialistActiveOrganizationBody } from '../dto/patch-specialist-active-organization-body.schema';
import { computeListedInDirectory } from '../domain/specialist-directory-flags';
import { syncOrganizationServiceCategoriesFromSpecialistServices } from '../../organizations/infrastructure/organization-service-category-sync';

@Injectable()
export class SpecialistWorkplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsRepository: BookingsRepository,
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
    return {
      organizations: employments.map((e) => ({
        id: e.organization.id,
        name: e.organization.name,
        role: e.role,
        isActiveWorkplace:
          specialist.activeOrganizationId === e.organization.id,
        publicationModerationStatus: e.organization.publicationModerationStatus,
      })),
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

  async setActiveOrganization(
    userId: string,
    body: PatchSpecialistActiveOrganizationBody,
  ): Promise<{ activeOrganizationId: string; cancelledBookingsCount: number }> {
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
