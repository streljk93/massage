"use client";

import { useMemo } from "react";
import { BriefcaseBusiness, Plus, UserRound } from "lucide-react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/app/i18n/navigation";
import type { AppLocale } from "@/app/i18n/routing";
import { BusinessEmptyState } from "@/entities/business";
import {
  canOrganization,
  OrganizationCapabilities,
  pickSelectedContextOrganization,
  specialistMyOrganizationsQueryKey,
} from "@/entities/organizations";
import { useSetBusinessPageTitle } from "@/widgets/business/chrome";
import {
  createBrowserSdkClient,
  hiringListCandidates,
  organizationsCabinetGetCabinetOrganizationProfileForEdit,
  organizationHiringCreateJobPosting,
  organizationHiringListApplications,
  organizationHiringListJobPostings,
  organizationHiringPatchJobPosting,
  specialistsCabinetGetSpecialistMyOrganizations,
} from "@/shared/api";
import type {
  HiringListCandidatesResponse,
  OrganizationHiringListApplicationsResponse,
  OrganizationHiringListJobPostingsResponse,
} from "@/shared/api/generated/sdk/types.gen";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
} from "@/shared/ui";
import { Skeleton } from "@/shared/ui/shadcn/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServiceCategories } from "../model/use-service-categories";

const JOBS_QK = ["jobs"] as const;
const CONTACTS_QK = ["contacts"] as const;
const CANDIDATES_QK = ["candidates"] as const;
const CABINET_PROFILE_QK = ["businessHiringCabinetProfile"] as const;

type JobPosting =
  OrganizationHiringListJobPostingsResponse["jobPostings"][number];
type HiringContact =
  OrganizationHiringListApplicationsResponse["contacts"][number];
type Candidate = HiringListCandidatesResponse["candidates"][number];

function jobsQueryKey(organizationId: string) {
  return [...JOBS_QK, { organizationId }] as const;
}

function contactsQueryKey(organizationId: string) {
  return [...CONTACTS_QK, { organizationId }] as const;
}

function candidatesQueryKey(jobId: string, filters: Record<string, unknown>) {
  return [...CANDIDATES_QK, { jobId, filters }] as const;
}

export function BusinessHiringPage() {
  const t = useTranslations("businessHiringPage");
  useSetBusinessPageTitle(t("title"));
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken ?? "";
  const authed = sessionStatus === "authenticated" && accessToken.length > 0;
  const queryClient = useQueryClient();

  const sdk = useMemo(
    () => createBrowserSdkClient(accessToken, { locale }),
    [accessToken, locale],
  );

  const orgsQuery = useQuery({
    queryKey: specialistMyOrganizationsQueryKey(accessToken, locale),
    enabled: authed,
    queryFn: async () => {
      const { data, error } = await specialistsCabinetGetSpecialistMyOrganizations({
        client: sdk,
      });
      if (error || !data) throw error ?? new Error("organizations");
      return data;
    },
  });

  const activeOrg = useMemo(
    () => pickSelectedContextOrganization(orgsQuery.data),
    [orgsQuery.data],
  );
  const organizationId = activeOrg?.id ?? "";
  const canViewHiring = canOrganization(
    activeOrg,
    OrganizationCapabilities.HIRING_VIEW,
  );
  const canManageHiring = canOrganization(
    activeOrg,
    OrganizationCapabilities.HIRING_MANAGE,
  );

  const cabinetProfileQuery = useQuery({
    queryKey: [...CABINET_PROFILE_QK, { organizationId, locale }],
    enabled: authed && organizationId.length > 0 && canManageHiring,
    queryFn: async () => {
      const { data, error } =
        await organizationsCabinetGetCabinetOrganizationProfileForEdit({
          client: sdk,
          path: { organizationId },
          query: { locale },
        });
      if (error || !data) throw error ?? new Error("cabinet profile");
      return data;
    },
  });

  const majorCategorySlugs = cabinetProfileQuery.data?.majorCategorySlugs ?? [];

  const jobsQuery = useQuery({
    queryKey: jobsQueryKey(organizationId),
    enabled: authed && organizationId.length > 0 && canViewHiring,
    queryFn: async () => {
      const { data, error } = await organizationHiringListJobPostings({
        client: sdk,
        path: { organizationId },
      });
      if (error || !data) throw error ?? new Error("jobs");
      return data;
    },
  });

  const contactsQuery = useQuery({
    queryKey: contactsQueryKey(organizationId),
    enabled: authed && organizationId.length > 0 && canViewHiring,
    queryFn: async () => {
      const { data, error } = await organizationHiringListApplications({
        client: sdk,
        path: { organizationId },
      });
      if (error || !data) throw error ?? new Error("contacts");
      return data;
    },
  });

  const categoriesQuery = useServiceCategories({
    sdk,
    locale,
    majorCategorySlugs,
  });
  const categoryById = useMemo(
    () => new Map((categoriesQuery.data ?? []).map((item) => [item.id, item])),
    [categoriesQuery.data],
  );

  const createJobMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await organizationHiringCreateJobPosting({
        client: sdk,
        path: { organizationId },
        body: {
          title: t("newJobTitle"),
          role: "specialist",
          status: "draft",
        },
      });
      if (error || !data) throw error ?? new Error("create job");
      return data;
    },
    onSuccess: (job) => {
      void queryClient.invalidateQueries({ queryKey: jobsQueryKey(organizationId) });
      router.push(`/business/hiring/job-postings/${job.id}`);
    },
  });

  const closeJobMutation = useMutation({
    mutationFn: async (job: JobPosting) => {
      const { error } = await organizationHiringPatchJobPosting({
        client: sdk,
        path: { organizationId, jobPostingId: job.id },
        body: { status: "closed" },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jobsQueryKey(organizationId) });
    },
  });

  if (sessionStatus === "loading" || orgsQuery.isPending) {
    return (
      <main className="flex w-full flex-1 flex-col gap-4 px-4 pt-2">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </main>
    );
  }

  if (!authed || activeOrg == null || !canViewHiring) {
    return (
      <main className="flex w-full flex-1 flex-col px-4 pt-2">
        <BusinessEmptyState
          icon={BriefcaseBusiness}
          title={t("emptyTitle")}
          description={t("emptyHint")}
        />
      </main>
    );
  }

  return (
    <main className="flex w-full min-w-0 flex-1 flex-col gap-5 px-4 pt-2 pb-6">
      <section className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-primary uppercase">
              {t("eyebrow")}
            </p>
            <h1 className="mt-1 font-heading text-xl font-semibold">
              {t("heroTitle")}
            </h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              {t("heroHint")}
            </p>
          </div>
        </div>
      </section>

      <JobsPanel
        jobs={jobsQuery.data?.jobPostings ?? []}
        contacts={contactsQuery.data?.contacts ?? []}
        canManageHiring={canManageHiring}
        sdk={sdk}
        categoryById={categoryById}
        isCreating={createJobMutation.isPending}
        onCreateJob={() => createJobMutation.mutate()}
        closeDisabled={closeJobMutation.isPending}
        onCloseJob={(job) => closeJobMutation.mutate(job)}
      />
    </main>
  );
}

function JobsPanel({
  jobs,
  contacts,
  canManageHiring,
  sdk,
  categoryById,
  isCreating,
  onCreateJob,
  closeDisabled,
  onCloseJob,
}: {
  jobs: JobPosting[];
  contacts: HiringContact[];
  canManageHiring: boolean;
  sdk: ReturnType<typeof createBrowserSdkClient>;
  categoryById: Map<string, { label: string; name: string }>;
  isCreating: boolean;
  onCreateJob: () => void;
  closeDisabled: boolean;
  onCloseJob: (job: JobPosting) => void;
}) {
  const t = useTranslations("businessHiringPage");
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <BriefcaseBusiness className="size-4 text-primary" aria-hidden />
        <h2 className="font-heading text-base font-semibold">
          {t("jobsTitle")}
        </h2>
      </div>
      {canManageHiring ? (
        <div className="rounded-2xl border border-border/60 bg-card p-3">
          <Button type="button" disabled={isCreating} onClick={onCreateJob}>
            <Plus className="size-4" aria-hidden />
            {t("createJob")}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("createJobHint")}
          </p>
        </div>
      ) : null}
      <div className="grid gap-2">
        {jobs.length === 0 ? (
          <BusinessEmptyState
            icon={BriefcaseBusiness}
            title={t("noJobsTitle")}
            description={t("noJobsHint")}
          />
        ) : null}
        {jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            sdk={sdk}
            categoryName={
              job.serviceCategoryId != null ?
                categoryById.get(job.serviceCategoryId)?.name ??
                job.serviceCategoryName ??
                null
              : null
            }
            closeDisabled={closeDisabled}
            onClose={() => onCloseJob(job)}
          />
        ))}
        {contacts.length > 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 p-3">
            <p className="text-sm font-medium">{t("contactsTitle")}</p>
            <div className="mt-2 flex flex-col gap-1">
              {contacts.slice(0, 5).map((contact) => (
                <p key={contact.id} className="text-xs text-muted-foreground">
                  {t(`contactSource.${contact.source}`)} ·{" "}
                  {t(`contactStatus.${contact.status}`)}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function JobCard({
  job,
  sdk,
  categoryName,
  closeDisabled,
  onClose,
}: {
  job: JobPosting;
  sdk: ReturnType<typeof createBrowserSdkClient>;
  categoryName: string | null;
  closeDisabled: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("businessHiringPage");
  const candidatesQuery = useQuery({
    queryKey: candidatesQueryKey(job.id, { limit: 5 }),
    enabled: job.serviceCategoryId != null && job.status !== "closed",
    queryFn: async () => {
      const { data, error } = await hiringListCandidates({
        client: sdk,
        query: { jobPostingId: job.id, limit: 5 },
      });
      if (error || !data) throw error ?? new Error("job candidates");
      return data;
    },
  });
  const candidates = candidatesQuery.data?.candidates ?? [];
  const candidatesCountLabel = t("candidatesCount", {
    count: candidates.length,
    plus: candidatesQuery.data?.nextCursor != null ? "+" : "",
  });

  return (
    <article className="rounded-2xl border border-border/60 bg-card px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Link
          href={`/business/hiring/job-postings/${job.id}`}
          className="min-w-0 flex-1"
        >
          <p className="font-heading text-sm font-semibold">{job.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {categoryName ?? t("categoryMissing")} ·{" "}
            {job.experienceMinYears == null ?
              t("experienceAny")
            : t("experienceFrom", { years: job.experienceMinYears })}
          </p>
        </Link>
        <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">
          {t(`jobStatus.${job.status}`)}
        </span>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
        <span>{candidatesCountLabel}</span>
        <span>{t("applicationsCount", { count: job.applicationsCount })}</span>
        <span>{t("confidenceHint")}</span>
      </div>
      <div className="mt-3 grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{t("matchingCandidatesTitle")}</p>
          <Link
            href={`/business/hiring/search?jobPostingId=${job.id}`}
            className="text-xs font-medium text-primary"
          >
            {t("viewAllCandidates")}
          </Link>
        </div>
        {candidatesQuery.isPending ? (
          <Skeleton className="h-12 rounded-xl" />
        ) : candidates.length > 0 ? (
          candidates.map((candidate) => (
            <CandidateMiniCard key={candidate.specialistId} candidate={candidate} />
          ))
        ) : (
          <p className="text-xs text-muted-foreground">{t("zeroMatchHint")}</p>
        )}
      </div>
      {job.status !== "closed" ? (
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={closeDisabled}
            onClick={onClose}
          >
            {t("closeJob")}
          </Button>
        </div>
      ) : null}
    </article>
  );
}

function CandidateMiniCard({ candidate }: { candidate: Candidate }) {
  const t = useTranslations("businessHiringPage");
  return (
    <Link
      href={`/specialists/${candidate.specialistId}`}
      className="flex items-center gap-3 rounded-xl border border-border/60 bg-background px-3 py-2"
    >
      <Avatar className="size-9">
        {candidate.imageUrl ? (
          <AvatarImage src={candidate.imageUrl} alt="" />
        ) : null}
        <AvatarFallback>
          <UserRound className="size-4" aria-hidden />
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {candidate.displayName ?? candidate.specialistId}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {candidate.experienceYears == null ?
            t("experienceUnknown")
          : t("candidateExperience", { years: candidate.experienceYears })}
          {" · "}
          {candidate.headline ?? candidate.summary ?? t("candidateNoBio")}
        </p>
      </div>
      <span className="text-xs font-medium text-primary">
        {t("matchScore", { score: Math.round(candidate.matchScore * 100) })}
      </span>
    </Link>
  );
}
