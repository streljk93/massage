import { Injectable } from '@nestjs/common';
import {
  HiringContactSource,
  HiringContactStatus,
  JobApplicationStatus,
  JobPostingStatus,
  OrganizationMembershipRole,
  SpecialistResumeVisibility,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

type PrismaLike = PrismaService | Prisma.TransactionClient;

export type CandidateSearchFilters = {
  cursor: string | undefined;
  limit: number;
  q: string | undefined;
  skillCategoryIds: string[];
  experienceMinYears: number | undefined;
  experienceMaxYears: number | undefined;
};

export type CandidateSearchRow = {
  specialistId: string;
  skillsCategoryIds: string[];
  experienceYears: number | null;
  updatedAt: Date;
  specialist: {
    listingName: string | null;
    imageUrl: string | null;
    user: { name: string | null };
    resume: {
      headline: string | null;
      summary: string | null;
      experienceYears: number | null;
    } | null;
  };
};

@Injectable()
export class HiringRepository {
  constructor(private readonly prisma: PrismaService) {}

  listJobPostings(organizationId: string) {
    return this.prisma.jobPosting.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        serviceCategory: { select: { name: true } },
        _count: { select: { applications: true } },
      },
    });
  }

  getJobPosting(id: string, prisma: PrismaLike = this.prisma) {
    return prisma.jobPosting.findFirst({
      where: { id, deletedAt: null },
      include: {
        organization: { select: { id: true, name: true } },
        serviceCategory: { select: { id: true, name: true } },
      },
    });
  }

  createJobPosting(
    organizationId: string,
    createdByUserId: string,
    data: {
      title: string;
      description?: string | null;
      requirements?: string | null;
      organizationOfferingId?: string | null;
      serviceCategoryId?: string | null;
      experienceMinYears?: number | null;
      role?: 'admin' | 'specialist';
      status?: 'draft' | 'open' | 'closed';
    },
  ) {
    return this.prisma.jobPosting.create({
      data: {
        organizationId,
        createdByUserId,
        title: data.title,
        description: data.description ?? null,
        requirements: data.requirements ?? null,
        organizationOfferingId: data.organizationOfferingId ?? null,
        serviceCategoryId: data.serviceCategoryId ?? null,
        experienceMinYears: data.experienceMinYears ?? null,
        role:
          data.role === 'admin'
            ? OrganizationMembershipRole.admin
            : OrganizationMembershipRole.specialist,
        status: toJobPostingStatus(data.status),
      },
      include: {
        serviceCategory: { select: { name: true } },
        _count: { select: { applications: true } },
      },
    });
  }

  patchJobPosting(
    id: string,
    organizationId: string,
    data: {
      title?: string;
      description?: string | null;
      requirements?: string | null;
      organizationOfferingId?: string | null;
      serviceCategoryId?: string | null;
      experienceMinYears?: number | null;
      role?: 'admin' | 'specialist';
      status?: 'draft' | 'open' | 'closed';
    },
  ) {
    return this.prisma.jobPosting.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.requirements !== undefined
          ? { requirements: data.requirements }
          : {}),
        ...(data.organizationOfferingId !== undefined
          ? { organizationOfferingId: data.organizationOfferingId }
          : {}),
        ...(data.serviceCategoryId !== undefined
          ? { serviceCategoryId: data.serviceCategoryId }
          : {}),
        ...(data.experienceMinYears !== undefined
          ? { experienceMinYears: data.experienceMinYears }
          : {}),
        ...(data.role !== undefined
          ? {
              role:
                data.role === 'admin'
                  ? OrganizationMembershipRole.admin
                  : OrganizationMembershipRole.specialist,
            }
          : {}),
        ...(data.status !== undefined
          ? { status: toJobPostingStatus(data.status) }
          : {}),
      },
      include: {
        serviceCategory: { select: { name: true } },
        _count: { select: { applications: true } },
      },
    });
  }

  getSpecialistByUserId(userId: string, prisma: PrismaLike = this.prisma) {
    return prisma.specialist.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true, user: { select: { name: true } } },
    });
  }

  getResume(specialistId: string) {
    return this.prisma.specialistResume.findFirst({
      where: { specialistId, deletedAt: null },
    });
  }

  async upsertResume(
    specialistId: string,
    createdByUserId: string,
    data: {
      headline?: string | null;
      summary?: string | null;
      experienceYears?: number | null;
      visibility?: 'public' | 'private';
    },
  ) {
    const resume = await this.prisma.specialistResume.upsert({
      where: { specialistId },
      create: {
        specialistId,
        createdByUserId,
        headline: data.headline ?? null,
        summary: data.summary ?? null,
        experienceYears: data.experienceYears ?? null,
        visibility:
          data.visibility === 'public'
            ? SpecialistResumeVisibility.public
            : SpecialistResumeVisibility.private,
      },
      update: {
        ...(data.headline !== undefined ? { headline: data.headline } : {}),
        ...(data.summary !== undefined ? { summary: data.summary } : {}),
        ...(data.experienceYears !== undefined
          ? { experienceYears: data.experienceYears }
          : {}),
        ...(data.visibility !== undefined
          ? {
              visibility:
                data.visibility === 'public'
                  ? SpecialistResumeVisibility.public
                  : SpecialistResumeVisibility.private,
            }
          : {}),
        deletedAt: null,
      },
    });
    await this.refreshSpecialistSearchProjection(specialistId);
    return resume;
  }

  async refreshSpecialistSearchProjection(specialistId: string) {
    const specialist = await this.prisma.specialist.findFirst({
      where: { id: specialistId, deletedAt: null },
      select: {
        id: true,
        listingName: true,
        bio: true,
        experienceYears: true,
        user: { select: { name: true } },
        profile: { select: { isActive: true } },
        workplaces: {
          where: { isActive: true, deletedAt: null },
          select: { id: true },
          take: 1,
        },
        skills: { select: { serviceCategoryId: true } },
        resume: {
          select: {
            headline: true,
            summary: true,
            experienceYears: true,
            deletedAt: true,
          },
        },
      },
    });
    if (specialist == null) return;
    await this.prisma.specialistSearchProjection.upsert({
      where: { specialistId },
      create: {
        specialistId,
        skillsCategoryIds: specialist.skills.map(
          (skill) => skill.serviceCategoryId,
        ),
        experienceYears:
          specialist.resume?.experienceYears ?? specialist.experienceYears,
        isActive: specialist.profile?.isActive ?? false,
        hasActiveWorkplace: specialist.workplaces.length > 0,
        textSearch: [
          specialist.listingName,
          specialist.user.name,
          specialist.bio,
          specialist.resume?.headline,
          specialist.resume?.summary,
        ]
          .filter(Boolean)
          .join(' '),
      },
      update: {
        skillsCategoryIds: specialist.skills.map(
          (skill) => skill.serviceCategoryId,
        ),
        experienceYears:
          specialist.resume?.experienceYears ?? specialist.experienceYears,
        isActive: specialist.profile?.isActive ?? false,
        hasActiveWorkplace: specialist.workplaces.length > 0,
        textSearch: [
          specialist.listingName,
          specialist.user.name,
          specialist.bio,
          specialist.resume?.headline,
          specialist.resume?.summary,
        ]
          .filter(Boolean)
          .join(' '),
      },
    });
  }

  async listCandidates(
    filters: CandidateSearchFilters,
  ): Promise<CandidateSearchRow[]> {
    const where: Prisma.SpecialistSearchProjectionWhereInput = {
      isActive: true,
      hasActiveWorkplace: true,
      specialist: {
        deletedAt: null,
        resume: {
          is: {
            deletedAt: null,
            visibility: SpecialistResumeVisibility.public,
          },
        },
      },
      ...(filters.cursor ? { specialistId: { lt: filters.cursor } } : {}),
      ...(filters.experienceMinYears !== undefined ||
      filters.experienceMaxYears !== undefined
        ? {
            experienceYears: {
              ...(filters.experienceMinYears !== undefined
                ? { gte: filters.experienceMinYears }
                : {}),
              ...(filters.experienceMaxYears !== undefined
                ? { lte: filters.experienceMaxYears }
                : {}),
            },
          }
        : {}),
      ...(filters.skillCategoryIds.length > 0
        ? { skillsCategoryIds: { hasEvery: filters.skillCategoryIds } }
        : {}),
      ...(filters.q
        ? { textSearch: { contains: filters.q, mode: 'insensitive' } }
        : {}),
    };

    return this.prisma.specialistSearchProjection.findMany({
      where,
      take: filters.limit + 1,
      orderBy: { specialistId: 'desc' },
      include: {
        specialist: {
          select: {
            id: true,
            listingName: true,
            imageUrl: true,
            user: { select: { name: true } },
            resume: {
              select: {
                headline: true,
                summary: true,
                experienceYears: true,
              },
            },
          },
        },
      },
    });
  }

  findActiveContact(
    prisma: PrismaLike,
    organizationId: string,
    specialistId: string,
  ) {
    return prisma.hiringContact.findFirst({
      where: { organizationId, specialistId, isActive: true, deletedAt: null },
      include: { application: true },
    });
  }

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(fn);
  }
}

function toJobPostingStatus(
  status: 'draft' | 'open' | 'closed' | undefined,
): JobPostingStatus {
  if (status === 'open') return JobPostingStatus.open;
  if (status === 'closed') return JobPostingStatus.closed;
  return JobPostingStatus.draft;
}

export const HiringEnums = {
  contactSource: HiringContactSource,
  contactStatus: HiringContactStatus,
  applicationStatus: JobApplicationStatus,
  membershipRole: OrganizationMembershipRole,
};
