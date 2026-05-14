import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type OrganizationMembershipRole } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  OrganizationCapabilities,
  assertCanOrganization,
} from '../../organizations/domain/policy';
import { OrganizationAccessPolicyService } from '../../organizations/application/organization-access-policy.service';
import {
  HiringEnums,
  HiringRepository,
  type CandidateSearchFilters,
} from '../infrastructure/hiring.repository';
import { MatchingEngine, type MatchReason } from './matching-engine';
import { recomputeListedInDirectoryTx } from '../../specialists/application/recompute-specialist-listed-in-directory';
import type {
  ApplyToJobPostingBody,
  CandidateListQuery,
  CreateJobPostingBody,
  PatchJobPostingBody,
  PatchResumeBody,
  ReviewApplicationBody,
} from '../dto/hiring.schemas';

type CandidateListItemDto = {
  specialistId: string;
  displayName: string | null;
  imageUrl: string | null;
  headline: string | null;
  summary: string | null;
  experienceYears: number | null;
  skillsCategoryIds: string[];
  matchScore: number;
  matchReasons: MatchReason[];
  matchedCategoryIds: string[];
};

@Injectable()
export class HiringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: HiringRepository,
    private readonly matchingEngine: MatchingEngine,
    private readonly organizationAccess: OrganizationAccessPolicyService,
  ) {}

  async listJobPostings(userId: string, organizationId: string) {
    await this.assertHiring(userId, organizationId, 'view');
    const rows = await this.repository.listJobPostings(organizationId);
    return { jobPostings: rows.map(mapJobPosting) };
  }

  async createJobPosting(
    userId: string,
    organizationId: string,
    body: CreateJobPostingBody,
  ) {
    await this.assertHiring(userId, organizationId, 'manage');
    this.assertOpenJobPostingHasCategory(body.status, body.serviceCategoryId);
    await this.assertOfferingAndCategoryScope(organizationId, body);
    const row = await this.repository.createJobPosting(
      organizationId,
      userId,
      body,
    );
    return mapJobPosting(row);
  }

  async patchJobPosting(
    userId: string,
    organizationId: string,
    jobPostingId: string,
    body: PatchJobPostingBody,
  ) {
    await this.assertHiring(userId, organizationId, 'manage');
    await this.assertOfferingAndCategoryScope(organizationId, body);
    const existing = await this.repository.getJobPosting(jobPostingId);
    if (existing == null || existing.organizationId !== organizationId) {
      throw new NotFoundException({
        code: 'JOB_POSTING_NOT_FOUND',
        message: 'Job posting not found',
      });
    }
    this.assertOpenJobPostingHasCategory(
      body.status ?? existing.status,
      body.serviceCategoryId === undefined
        ? existing.serviceCategoryId
        : body.serviceCategoryId,
    );
    const row = await this.repository.patchJobPosting(
      jobPostingId,
      organizationId,
      body,
    );
    return mapJobPosting(row);
  }

  async listCandidates(userId: string, query: CandidateListQuery) {
    return this.listCandidateMatches(userId, query);
  }

  async listJobPostingCandidates(
    userId: string,
    jobPostingId: string,
    query: CandidateListQuery,
  ) {
    const job = await this.repository.getJobPosting(jobPostingId);
    if (job == null) {
      throw new NotFoundException({
        code: 'JOB_POSTING_NOT_FOUND',
        message: 'Job posting not found',
      });
    }
    await this.assertHiring(userId, job.organizationId, 'view');
    return this.listCandidateMatches(userId, {
      ...query,
      jobPostingId,
    });
  }

  async getMyResume(userId: string) {
    const specialist = await this.mustGetSpecialist(userId);
    const resume = await this.repository.getResume(specialist.id);
    return mapResume(resume);
  }

  async patchMyResume(userId: string, body: PatchResumeBody) {
    const specialist = await this.mustGetSpecialist(userId);
    const resume = await this.repository.upsertResume(
      specialist.id,
      userId,
      body,
    );
    return mapResume(resume);
  }

  async rebuildSpecialistSearchProjection(specialistId: string) {
    await this.repository.refreshSpecialistSearchProjection(specialistId);
  }

  async applyToJobPosting(
    userId: string,
    jobPostingId: string,
    body: ApplyToJobPostingBody,
  ) {
    const specialist = await this.mustGetSpecialist(userId);
    const job = await this.repository.getJobPosting(jobPostingId);
    if (job == null || job.status !== 'open') {
      throw new NotFoundException({
        code: 'JOB_POSTING_NOT_FOUND',
        message: 'Open job posting not found',
      });
    }

    const contact = await this.repository.transaction(async (tx) => {
      const existing = await this.repository.findActiveContact(
        tx,
        job.organizationId,
        specialist.id,
      );
      if (existing != null) return existing;
      return tx.hiringContact.create({
        data: {
          organizationId: job.organizationId,
          specialistId: specialist.id,
          jobPostingId: job.id,
          createdByUserId: userId,
          source: HiringEnums.contactSource.application,
          status: HiringEnums.contactStatus.pending,
          isActive: true,
          application: {
            create: {
              jobPostingId: job.id,
              specialistId: specialist.id,
              createdByUserId: userId,
              status: HiringEnums.applicationStatus.pending,
              message: body.message ?? null,
              jobPostingSnapshot: buildJobPostingSnapshot(job),
            },
          },
        },
        include: { application: true },
      });
    });
    return { contact: mapContact(contact) };
  }

  async listOrganizationApplications(userId: string, organizationId: string) {
    await this.assertHiring(userId, organizationId, 'reviewApplications');
    const contacts = await this.prisma.hiringContact.findMany({
      where: {
        organizationId,
        deletedAt: null,
        application: { isNot: null },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { application: true },
    });
    return { contacts: contacts.map(mapContact) };
  }

  async reviewApplication(
    userId: string,
    organizationId: string,
    contactId: string,
    body: ReviewApplicationBody,
  ) {
    await this.assertHiring(userId, organizationId, 'accept');
    const contact = await this.prisma.hiringContact.findFirst({
      where: { id: contactId, organizationId, deletedAt: null },
      include: { application: true },
    });
    if (contact == null || contact.application == null) {
      throw new NotFoundException({
        code: 'APPLICATION_CONTACT_NOT_FOUND',
        message: 'Application contact not found',
      });
    }
    if (body.decision === 'rejected') {
      return { contact: mapContact(await this.rejectContact(contact.id)) };
    }
    return { contact: mapContact(await this.acceptContact(contact.id)) };
  }

  private async listCandidateMatches(
    userId: string,
    query: CandidateListQuery,
  ) {
    let jobFilters: {
      serviceCategoryId: string | null;
      experienceMinYears: number | null;
    } | null = null;
    if (query.jobPostingId != null) {
      const job = await this.repository.getJobPosting(query.jobPostingId);
      if (job == null) {
        throw new NotFoundException({
          code: 'JOB_POSTING_NOT_FOUND',
          message: 'Job posting not found',
        });
      }
      await this.assertHiring(userId, job.organizationId, 'view');
      jobFilters = {
        serviceCategoryId: job.serviceCategoryId,
        experienceMinYears: job.experienceMinYears,
      };
    }
    const filters = buildCandidateSearchFilters(query, jobFilters);
    const result = await this.matchingEngine.searchCandidates(filters);
    return {
      candidates: result.candidates.map(mapCandidate),
      nextCursor: result.nextCursor,
    };
  }

  private async acceptContact(contactId: string) {
    return this.repository.transaction(async (tx) => {
      const contact = await tx.hiringContact.findFirst({
        where: { id: contactId, deletedAt: null },
        include: { application: true },
      });
      if (contact == null) {
        throw new NotFoundException({
          code: 'HIRING_CONTACT_NOT_FOUND',
          message: 'Hiring contact not found',
        });
      }
      if (contact.status === HiringEnums.contactStatus.accepted) {
        return contact;
      }
      await tx.hiringContact.update({
        where: { id: contact.id },
        data: { status: HiringEnums.contactStatus.accepted, isActive: false },
      });
      if (contact.application != null) {
        await tx.jobApplication.update({
          where: { id: contact.application.id },
          data: { status: HiringEnums.applicationStatus.accepted },
        });
      }
      await this.createOrActivateEmployment(tx, contact);
      return tx.hiringContact.findFirstOrThrow({
        where: { id: contact.id },
        include: { application: true },
      });
    });
  }

  private async rejectContact(contactId: string) {
    return this.repository.transaction(async (tx) => {
      const contact = await tx.hiringContact.findFirst({
        where: { id: contactId, deletedAt: null },
        include: { application: true },
      });
      if (contact == null) {
        throw new NotFoundException({
          code: 'HIRING_CONTACT_NOT_FOUND',
          message: 'Hiring contact not found',
        });
      }
      await tx.hiringContact.update({
        where: { id: contact.id },
        data: { status: HiringEnums.contactStatus.rejected, isActive: false },
      });
      if (contact.application != null) {
        await tx.jobApplication.update({
          where: { id: contact.application.id },
          data: { status: HiringEnums.applicationStatus.rejected },
        });
      }
      return tx.hiringContact.findFirstOrThrow({
        where: { id: contact.id },
        include: { application: true },
      });
    });
  }

  private async createOrActivateEmployment(
    tx: Prisma.TransactionClient,
    contact: {
      organizationId: string;
      specialistId: string;
    },
  ) {
    const existing = await tx.specialistOrganizationEmployment.findFirst({
      where: {
        organizationId: contact.organizationId,
        specialistId: contact.specialistId,
      },
    });
    const role = HiringEnums.membershipRole.specialist;
    if (existing != null) {
      if (!existing.isActive || existing.role !== role) {
        await tx.specialistOrganizationEmployment.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            endDate: null,
            startDate: new Date(),
            role,
          },
        });
      }
    } else {
      await tx.specialistOrganizationEmployment.create({
        data: {
          organizationId: contact.organizationId,
          specialistId: contact.specialistId,
          role,
          startDate: new Date(),
          isActive: true,
        },
      });
    }
    const activeWorkplacesCount = await tx.specialistWorkplace.count({
      where: {
        specialistId: contact.specialistId,
        isActive: true,
        deletedAt: null,
      },
    });
    await tx.specialistWorkplace.upsert({
      where: {
        specialistId_organizationId: {
          specialistId: contact.specialistId,
          organizationId: contact.organizationId,
        },
      },
      create: {
        specialistId: contact.specialistId,
        organizationId: contact.organizationId,
        isActive: activeWorkplacesCount === 0,
      },
      update: { deletedAt: null },
    });
    await recomputeListedInDirectoryTx(tx, contact.specialistId);
  }

  private async assertHiring(
    userId: string,
    organizationId: string,
    action: 'view' | 'manage' | 'reviewApplications' | 'accept',
  ) {
    const ctx = await this.organizationAccess.resolveContext(
      userId,
      organizationId,
    );
    const capability =
      action === 'manage'
        ? OrganizationCapabilities.HIRING_MANAGE
        : action === 'reviewApplications'
          ? OrganizationCapabilities.HIRING_REVIEW_APPLICATIONS
          : action === 'accept'
            ? OrganizationCapabilities.HIRING_ACCEPT
            : OrganizationCapabilities.HIRING_VIEW;
    assertCanOrganization(ctx, capability, {
      type: 'Organization',
      organizationId,
    });
  }

  private async mustGetSpecialist(userId: string) {
    const specialist = await this.repository.getSpecialistByUserId(userId);
    if (specialist == null) {
      throw new ForbiddenException({
        code: 'SPECIALIST_PROFILE_REQUIRED',
        message: 'Specialist profile is required',
      });
    }
    return specialist;
  }

  private async assertOfferingAndCategoryScope(
    organizationId: string,
    body: {
      organizationOfferingId?: string | null;
      serviceCategoryId?: string | null;
    },
  ) {
    if (body.organizationOfferingId != null) {
      const offering = await this.prisma.organizationOffering.findFirst({
        where: {
          id: body.organizationOfferingId,
          organizationId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (offering == null) {
        throw new BadRequestException({
          code: 'ORGANIZATION_OFFERING_NOT_FOUND',
          message: 'Offering is not available for this organization',
        });
      }
    }
    if (body.serviceCategoryId != null) {
      const category = await this.prisma.serviceCategory.findFirst({
        where: { id: body.serviceCategoryId, deletedAt: null, isActive: true },
        select: { id: true },
      });
      if (category == null) {
        throw new BadRequestException({
          code: 'SERVICE_CATEGORY_NOT_FOUND',
          message: 'Service category is not available',
        });
      }
    }
  }

  private assertOpenJobPostingHasCategory(
    status: string | undefined,
    serviceCategoryId: string | null | undefined,
  ) {
    if (status === 'open' && serviceCategoryId == null) {
      throw new BadRequestException({
        code: 'JOB_POSTING_CATEGORY_REQUIRED_FOR_OPEN_STATUS',
        message: 'serviceCategoryId is required when status is open',
      });
    }
  }
}

function buildCandidateSearchFilters(
  query: CandidateListQuery,
  jobFilters: {
    serviceCategoryId: string | null;
    experienceMinYears: number | null;
  } | null,
): CandidateSearchFilters {
  const directCategoryIds = [
    ...(query.serviceCategoryId != null ? [query.serviceCategoryId] : []),
    ...query.skillCategoryIds,
  ];
  return {
    cursor: query.cursor,
    limit: query.limit,
    q: query.q,
    skillCategoryIds:
      directCategoryIds.length > 0
        ? [...new Set(directCategoryIds)]
        : jobFilters?.serviceCategoryId != null
          ? [jobFilters.serviceCategoryId]
          : [],
    experienceMinYears:
      query.experienceMinYears ?? jobFilters?.experienceMinYears ?? undefined,
    experienceMaxYears: query.experienceMaxYears,
  };
}

function mapJobPosting(row: {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  requirements: string | null;
  organizationOfferingId: string | null;
  serviceCategoryId: string | null;
  serviceCategory?: { name: string } | null;
  experienceMinYears: number | null;
  role: OrganizationMembershipRole;
  status: string;
  _count?: { applications: number };
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    title: row.title,
    description: row.description,
    requirements: row.requirements,
    organizationOfferingId: row.organizationOfferingId,
    serviceCategoryId: row.serviceCategoryId,
    serviceCategoryName: row.serviceCategory?.name ?? null,
    experienceMinYears: row.experienceMinYears,
    role: row.role,
    status: row.status,
    applicationsCount: row._count?.applications ?? 0,
  };
}

function mapResume(
  resume: {
    headline: string | null;
    summary: string | null;
    experienceYears: number | null;
    visibility: string;
  } | null,
) {
  return {
    headline: resume?.headline ?? null,
    summary: resume?.summary ?? null,
    experienceYears: resume?.experienceYears ?? null,
    visibility: resume?.visibility ?? 'private',
  };
}

function mapCandidate(row: {
  specialistId: string;
  skillsCategoryIds: string[];
  matchScore: number;
  matchReasons: MatchReason[];
  matchedCategoryIds: string[];
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
}): CandidateListItemDto {
  return {
    specialistId: row.specialistId,
    displayName: row.specialist.listingName ?? row.specialist.user.name,
    imageUrl: row.specialist.imageUrl,
    headline: row.specialist.resume?.headline ?? null,
    summary: row.specialist.resume?.summary ?? null,
    experienceYears: row.specialist.resume?.experienceYears ?? null,
    skillsCategoryIds: row.skillsCategoryIds,
    matchScore: row.matchScore,
    matchReasons: row.matchReasons,
    matchedCategoryIds: row.matchedCategoryIds,
  };
}

function mapContact(contact: {
  id: string;
  organizationId: string;
  specialistId: string;
  jobPostingId: string | null;
  source: string;
  status: string;
  isActive: boolean;
  application?: {
    id: string;
    status: string;
    message: string | null;
    jobPostingSnapshot: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
  } | null;
}) {
  const type = contact.application == null ? 'manual' : 'application';
  return {
    type,
    id: contact.id,
    organizationId: contact.organizationId,
    specialistId: contact.specialistId,
    jobPostingId: contact.jobPostingId,
    source: contact.source,
    status: contact.status,
    isActive: contact.isActive,
    displayLabelKey: 'youApplied',
    application:
      contact.application == null
        ? null
        : {
            id: contact.application.id,
            status: contact.application.status,
            message: contact.application.message,
            jobPostingSnapshot: contact.application.jobPostingSnapshot,
            createdAt: contact.application.createdAt.toISOString(),
            updatedAt: contact.application.updatedAt.toISOString(),
          },
  };
}

function buildJobPostingSnapshot(job: {
  title: string;
  description: string | null;
  requirements: string | null;
  organizationOfferingId: string | null;
  serviceCategoryId: string | null;
  experienceMinYears: number | null;
  role: OrganizationMembershipRole;
  organization: { name: string };
  serviceCategory?: { name: string } | null;
}) {
  return {
    title: job.title,
    description: job.description,
    requirements: job.requirements,
    experienceMinYears: job.experienceMinYears,
    organizationOfferingId: job.organizationOfferingId,
    organizationName: job.organization.name,
    serviceCategoryId: job.serviceCategoryId,
    categoryName: job.serviceCategory?.name ?? null,
    role: job.role,
    salaryRange: null,
    location: null,
  };
}
