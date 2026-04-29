import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GalleryMediaKind,
  GalleryOwnerKind,
  OrganizationMembershipRole,
  PublicationModerationStatus,
  SpecialistWorkplaceJoinRequestStatus,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { ApiLocale } from '../../../common/i18n';
import { pickLocalizedOrganizationListItem } from '../../../common/i18n';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { organizationNonCategoryTextSearchWhere } from '../../directory/infrastructure/directory-list-query-filters';
import { AddressPersistenceService } from '../../address/application/address-persistence.service';
import { AddressResolutionService } from '../../address/application/address-resolution.service';
import { GalleryService } from '../../gallery/application/gallery.service';
import { ModerationEnqueueService } from '../../moderation/application/moderation-enqueue.service';
import { SpecialistOnboardingService } from '../../specialists/application/specialist-onboarding.service';
import { computeListedInDirectory } from '../../specialists/domain/specialist-directory-flags';
import type { CreateOrganizationBody } from '../dto/create-organization-body.schema';
import type { WorkplaceOrganizationSearchResponseDto } from '../dto/workplace-organization-search.dto';
import type {
  WorkplaceJoinRequestListQuery,
  WorkplaceJoinRequestReviewBody,
} from '../dto/workplace-join-request.schema';

@Injectable()
export class OrganizationCabinetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly addressResolution: AddressResolutionService,
    private readonly addressPersistence: AddressPersistenceService,
    private readonly gallery: GalleryService,
    private readonly specialistOnboarding: SpecialistOnboardingService,
    private readonly moderationEnqueue: ModerationEnqueueService,
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
    if (specialist.activeOrganizationId != null) {
      throw new ConflictException({
        code: 'WORKPLACE_ALREADY_SET',
        message: 'Active organization is already set',
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
    const alreadyMember = await this.prisma.specialistOrganizationEmployment.findFirst(
      {
        where: {
          specialistId: specialist.id,
          organizationId,
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
          yearsInBusiness: body.yearsInBusiness ?? null,
          publicationModerationStatus: PublicationModerationStatus.pending_review,
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

    await this.moderationEnqueue.enqueueOrganizationProfileModeration(orgId);

    return this.specialistOnboarding.getOnboarding(userId);
  }
}
