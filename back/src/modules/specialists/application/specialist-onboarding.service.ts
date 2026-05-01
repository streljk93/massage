import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PublicationModerationStatus,
  SpecialistWorkplaceJoinRequestStatus,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ContentModerationService } from '../../moderation/application/content-moderation.service';
import { computeListedInDirectory } from '../domain/specialist-directory-flags';
import type { PatchSpecialistProfileBody } from '../dto/specialist-body.schema';

type OnboardingStep = 1 | 3 | 4 | 5 | 6;

@Injectable()
export class SpecialistOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contentModeration: ContentModerationService,
  ) {}

  private isProfileComplete(
    user: { phone: string | null },
    spec: {
      bio: string | null;
      experienceYears: number | null;
      listingName: string | null;
    },
  ): boolean {
    if (!spec.listingName?.trim() || !user.phone?.trim()) {
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
      select: { phone: true },
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

  private async mapOnboarding(userId: string): Promise<{
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
        listingName: spec.listingName,
        imageUrl: spec.imageUrl,
        imageAlt: spec.imageAlt,
        profilePublicationModerationStatus:
          spec.profilePublicationModerationStatus,
        massage: spec.massageProfile
          ? {
              pressureLevel: spec.massageProfile.pressureLevel,
              pressureAdaptsToClient:
                spec.massageProfile.pressureAdaptsToClient,
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

  async patchProfile(userId: string, body: PatchSpecialistProfileBody) {
    const spec = await this.prisma.specialist.findFirst({
      where: { userId, deletedAt: null },
    });
    if (!spec) {
      throw new NotFoundException({
        code: 'SPECIALIST_PROFILE_NOT_FOUND',
        message: 'Specialist profile not found for this user',
      });
    }
    const prevSpec = await this.prisma.specialist.findFirst({
      where: { id: spec.id, deletedAt: null },
      select: {
        listingName: true,
        bio: true,
        experienceYears: true,
        imageUrl: true,
        imageAlt: true,
        profilePublicationModerationStatus: true,
      },
    });
    const touchesVitrineFields =
      body.name !== undefined ||
      body.bio !== undefined ||
      body.imageUrl !== undefined;
    await this.prisma.$transaction(async (tx) => {
      if (body.phone !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: { phone: body.phone },
        });
      }
      const specData: {
        listingName?: string;
        bio?: string;
        experienceYears?: number;
        imageUrl?: string | null;
        imageAlt?: string | null;
      } = {};
      if (body.name != null) {
        specData.listingName = body.name;
      }
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
        const freezeCatalogForGuests =
          touchesVitrineFields &&
          prevSpec?.profilePublicationModerationStatus ===
            PublicationModerationStatus.approved;
        await tx.specialist.update({
          where: { id: spec.id },
          data: {
            ...specData,
            ...(freezeCatalogForGuests && prevSpec != null
              ? {
                  catalogListedBio: prevSpec.bio ?? null,
                  catalogListedListingName: prevSpec.listingName ?? null,
                  catalogListedImageUrl: prevSpec.imageUrl ?? null,
                }
              : {}),
          },
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
    if (touchesVitrineFields) {
      await this.contentModeration.moderateSpecialistProfile(spec.id);
    }
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
}
