import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BOOKING_AUTO_CANCEL_MASTER_LEFT_WORKPLACE_EN } from '../../bookings/domain/booking-cancel-reason';
import { BookingsRepository } from '../../bookings/infrastructure/bookings.repository';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { PushNotificationsService } from '../../notifications/application/push-notifications.service';
import type { PatchSpecialistActiveOrganizationBody } from '../dto/patch-specialist-active-organization-body.schema';
import { computeListedInDirectory } from '../domain/specialist-directory-flags';

@Injectable()
export class SpecialistWorkplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsRepository: BookingsRepository,
    private readonly pushNotifications: PushNotificationsService,
  ) {}

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

    return {
      activeOrganizationId: body.organizationId,
      cancelledBookingsCount: cancelled.length,
    };
  }
}
