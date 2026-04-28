import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrganizationMembershipRole, SpecialistWorkplaceJoinRequestStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { ApiLocale } from '../../../common/i18n';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AddressPersistenceService } from '../../address/application/address-persistence.service';
import { AddressResolutionService } from '../../address/application/address-resolution.service';
import { computeListedInDirectory } from '../domain/specialist-directory-flags';
import type { CreateOnboardingOrganizationBody } from '../dto/specialist-onboarding-body.schema';
import type { JoinOnboardingOrganizationBody } from '../dto/specialist-onboarding-body.schema';
import type { PatchSpecialistOnboardingProfileBody } from '../dto/specialist-onboarding-body.schema';
import type {
  WorkplaceJoinRequestListQuery,
  WorkplaceJoinRequestReviewBody,
} from '../dto/workplace-join-request.schema';

type OnboardingStep = 1 | 3 | 4 | 5 | 6;

@Injectable()
export class SpecialistOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly addressResolution: AddressResolutionService,
    private readonly addressPersistence: AddressPersistenceService,
  ) {}

  private isProfileComplete(
    user: { name: string; phone: string | null },
    spec: { bio: string | null; experienceYears: number | null },
  ): boolean {
    if (!user.name?.trim() || !user.phone?.trim()) {
      return false;
    }
    if (!spec.bio?.trim() || spec.experienceYears == null) {
      return false;
    }
    return true;
  }

  private async countPersonalServices(specialistId: string): Promise<number> {
    return this.prisma.service.count({
      where: {
        specialistId,
        organizationId: null,
        deletedAt: null,
      },
    });
  }

  private async resolveStep(
    userId: string,
  ): Promise<{ step: OnboardingStep; specialistId: string | null }> {
    const spec = await this.prisma.specialist.findFirst({
      where: { userId, deletedAt: null },
    });
    if (!spec) {
      return { step: 1, specialistId: null };
    }
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { name: true, phone: true },
    });
    if (!user) {
      return { step: 1, specialistId: null };
    }
    if (!this.isProfileComplete(user, spec)) {
      return { step: 1, specialistId: spec.id };
    }
    const svcCount = await this.countPersonalServices(spec.id);
    if (svcCount < 1) {
      return { step: 3, specialistId: spec.id };
    }
    if (!spec.onboardingCompletedAt) {
      if (spec.activeOrganizationId) {
        return { step: 5, specialistId: spec.id };
      }
      const pendingJoin =
        await this.prisma.specialistWorkplaceJoinRequest.findFirst({
          where: {
            specialistId: spec.id,
            status: SpecialistWorkplaceJoinRequestStatus.pending,
          },
          orderBy: { updatedAt: 'desc' },
        });
      if (pendingJoin) {
        return { step: 5, specialistId: spec.id };
      }
      return { step: 4, specialistId: spec.id };
    }
    return { step: 6, specialistId: spec.id };
  }

  private async mapOnboarding(
    userId: string,
  ): Promise<{
    onboardingStep: OnboardingStep;
    specialist: Record<string, unknown> | null;
  }> {
    const { step, specialistId } = await this.resolveStep(userId);
    if (!specialistId) {
      return { onboardingStep: step, specialist: null };
    }
    const [spec, user] = await Promise.all([
      this.prisma.specialist.findFirst({
        where: { id: specialistId, deletedAt: null },
        include: { massageProfile: true },
      }),
      this.prisma.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: { name: true, phone: true, email: true, avatarUrl: true },
      }),
    ]);
    if (!spec || !user) {
      return { onboardingStep: 1, specialist: null };
    }
    const pendingJoin =
      await this.prisma.specialistWorkplaceJoinRequest.findFirst({
        where: {
          specialistId: spec.id,
          status: SpecialistWorkplaceJoinRequestStatus.pending,
        },
        include: {
          organization: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });
    return {
      onboardingStep: step,
      specialist: {
        id: spec.id,
        userId: spec.userId,
        bio: spec.bio,
        experienceYears: spec.experienceYears,
        imageUrl: spec.imageUrl,
        imageAlt: spec.imageAlt,
        massage: spec.massageProfile
          ? {
              pressureLevel: spec.massageProfile.pressureLevel,
              pressureAdaptsToClient: spec.massageProfile.pressureAdaptsToClient,
            }
          : null,
        activeOrganizationId: spec.activeOrganizationId,
        onboardingCompletedAt: spec.onboardingCompletedAt,
        userName: user.name,
        userPhone: user.phone,
        userEmail: user.email,
        userAvatarUrl: user.avatarUrl,
        pendingWorkplaceJoinRequest: pendingJoin
          ? {
              id: pendingJoin.id,
              organizationId: pendingJoin.organizationId,
              organizationName: pendingJoin.organization.name,
            }
          : null,
      },
    };
  }

  async getOnboarding(userId: string) {
    return this.mapOnboarding(userId);
  }

  async ensureSpecialist(userId: string): Promise<void> {
    const exists = await this.prisma.specialist.findFirst({
      where: { userId, deletedAt: null },
    });
    if (exists) {
      return;
    }
    await this.prisma.specialist.create({
      data: { userId },
    });
  }

  async patchProfile(
    userId: string,
    body: PatchSpecialistOnboardingProfileBody,
  ) {
    const spec = await this.prisma.specialist.findFirst({
      where: { userId, deletedAt: null },
    });
    if (!spec) {
      throw new NotFoundException({
        code: 'SPECIALIST_PROFILE_NOT_FOUND',
        message: 'Specialist profile not found for this user',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      const userPatch: { name?: string; phone?: string | null } = {};
      if (body.name != null) {
        userPatch.name = body.name;
      }
      if (body.phone !== undefined) {
        userPatch.phone = body.phone;
      }
      if (Object.keys(userPatch).length > 0) {
        await tx.user.update({
          where: { id: userId },
          data: userPatch,
        });
      }
      const specData: {
        bio?: string;
        experienceYears?: number;
        imageUrl?: string | null;
        imageAlt?: string | null;
      } = {};
      if (body.bio != null) {
        specData.bio = body.bio;
      }
      if (body.experienceYears !== undefined) {
        specData.experienceYears = body.experienceYears;
      }
      if (body.imageUrl !== undefined) {
        specData.imageUrl = body.imageUrl;
      }
      if (body.imageAlt !== undefined) {
        specData.imageAlt = body.imageAlt;
      }
      if (Object.keys(specData).length > 0) {
        await tx.specialist.update({
          where: { id: spec.id },
          data: specData,
        });
      }
      if (body.massage !== undefined) {
        const m = body.massage;
        if (
          m.pressureLevel !== undefined ||
          m.pressureAdaptsToClient !== undefined
        ) {
          const update: {
            pressureLevel?: number;
            pressureAdaptsToClient?: boolean;
          } = {};
          if (m.pressureLevel !== undefined) {
            update.pressureLevel = m.pressureLevel;
          }
          if (m.pressureAdaptsToClient !== undefined) {
            update.pressureAdaptsToClient = m.pressureAdaptsToClient;
          }
          await tx.specialistMassageProfile.upsert({
            where: { specialistId: spec.id },
            create: {
              specialistId: spec.id,
              ...update,
            },
            update,
          });
        }
      }
    });
    return this.mapOnboarding(userId);
  }

  async completeOnboarding(userId: string) {
    const { step, specialistId } = await this.resolveStep(userId);
    if (!specialistId) {
      throw new NotFoundException({
        code: 'SPECIALIST_PROFILE_NOT_FOUND',
        message: 'Specialist profile not found for this user',
      });
    }
    if (step !== 5) {
      throw new ConflictException({
        code: 'ONBOARDING_NOT_READY',
        message: 'Complete previous onboarding steps first',
      });
    }
    const spec = await this.prisma.specialist.findFirst({
      where: { id: specialistId, deletedAt: null },
    });
    if (!spec) {
      throw new NotFoundException({
        code: 'SPECIALIST_PROFILE_NOT_FOUND',
        message: 'Specialist profile not found for this user',
      });
    }
    const now = new Date();
    await this.prisma.specialist.update({
      where: { id: spec.id },
      data: {
        onboardingCompletedAt: now,
        listedInDirectory: computeListedInDirectory({
          onboardingCompletedAt: now,
          activeOrganizationId: spec.activeOrganizationId,
        }),
      },
    });
    return this.mapOnboarding(userId);
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

  /**
   * Принять мастера в организацию как `specialist`, выставить рабочее место.
   */
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

  /**
   * Владелец `Organization.ownerUserId` или активный мастер с ролью owner/admin в этой организации.
   */
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
   * Онбординг: отправить заявку «хочу работать в этой организации» (без членства до подтверждения владельцем).
   */
  async joinOrganization(
    userId: string,
    body: JoinOnboardingOrganizationBody,
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
    if (specialist.activeOrganizationId != null) {
      throw new ConflictException({
        code: 'WORKPLACE_ALREADY_SET',
        message: 'Active organization is already set',
      });
    }
    const org = await this.prisma.organization.findFirst({
      where: { id: body.organizationId, deletedAt: null },
    });
    if (!org) {
      throw new NotFoundException({
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Organization not found',
      });
    }
    const alreadyMember = await this.prisma.specialistOrganizationEmployment.findFirst(
      {
        where: {
          specialistId: specialist.id,
          organizationId: body.organizationId,
          isActive: true,
        },
      },
    );
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
            organizationId: body.organizationId,
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
            organizationId: body.organizationId,
          },
        },
        create: {
          specialistId: specialist.id,
          organizationId: body.organizationId,
          status: SpecialistWorkplaceJoinRequestStatus.pending,
        },
        update: {
          status: SpecialistWorkplaceJoinRequestStatus.pending,
          resolvedAt: null,
        },
      });
    });
    return this.mapOnboarding(userId);
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
   * Решение по заявке: принять / отклонить / заблокировать повторные заявки от этого мастера.
   */
  async reviewWorkplaceJoinRequest(
    userId: string,
    organizationId: string,
    requestId: string,
    body: WorkplaceJoinRequestReviewBody,
  ) {
    await this.assertUserCanManageOrgWorkplaceJoinRequests(
      userId,
      organizationId,
    );
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
   * Онбординг: создать организацию (текущий пользователь = владелец), витринные подкатегории,
   * трудоустройство `owner` и `activeOrganizationId` у специалиста.
   */
  async createOrganizationAndJoin(
    userId: string,
    body: CreateOnboardingOrganizationBody,
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
    if (specialist.activeOrganizationId != null) {
      throw new ConflictException({
        code: 'WORKPLACE_ALREADY_SET',
        message: 'Active organization is already set',
      });
    }
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
    } else {
      addressLine = body.addressLine!.trim();
      cityForDb = norm(body.city);
      latitude = body.latitude!;
      longitude = body.longitude!;
      sourceProvider = 'manual';
      sourceReference = null;
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
      const addr = await this.addressPersistence.createInTransaction(tx, {
        addressLine,
        city: cityForDb,
        latitude,
        longitude,
        sourceProvider,
        sourceReference,
      });
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
          imageUrl: body.imageUrl ?? null,
          imageAlt: norm(body.imageAlt),
          yearsInBusiness: body.yearsInBusiness ?? null,
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

      for (const catId of body.serviceCategoryIds) {
        await tx.organizationServiceCategory.create({
          data: {
            organizationId: orgId,
            serviceCategoryId: catId,
          },
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

      await tx.specialist.update({
        where: { id: specialist.id },
        data: { activeOrganizationId: orgId },
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
    });

    return this.mapOnboarding(userId);
  }
}
