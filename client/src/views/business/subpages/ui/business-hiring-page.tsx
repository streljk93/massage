"use client";

import { useMemo, useState } from "react";
import { BriefcaseBusiness, Plus } from "lucide-react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/app/i18n/navigation";
import type { AppLocale } from "@/app/i18n/routing";
import { BusinessEmptyState } from "@/entities/business";
import {
  canOrganization,
  OrganizationCapabilities,
  pickActiveWorkplaceOrganization,
  specialistMyOrganizationsQueryKey,
} from "@/entities/organizations";
import { useSetBusinessPageTitle } from "@/widgets/business/chrome";
import {
  createBrowserSdkClient,
  organizationHiringCreateJobPosting,
  organizationHiringListApplications,
  organizationHiringListJobPostings,
  specialistsCabinetGetSpecialistMyOrganizations,
} from "@/shared/api";
import type {
  OrganizationHiringListApplicationsResponse,
  OrganizationHiringListJobPostingsResponse,
} from "@/shared/api/generated/sdk/types.gen";
import { Button, Input } from "@/shared/ui";
import { Skeleton } from "@/shared/ui/shadcn/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const JOBS_QK = ["businessHiringJobs"] as const;
const CONTACTS_QK = ["businessHiringContacts"] as const;

type JobPosting =
  OrganizationHiringListJobPostingsResponse["jobPostings"][number];
type HiringContact =
  OrganizationHiringListApplicationsResponse["contacts"][number];

export function BusinessHiringPage() {
  const t = useTranslations("businessHiringPage");
  useSetBusinessPageTitle(t("title"));
  const locale = useLocale() as AppLocale;
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken ?? "";
  const authed = sessionStatus === "authenticated" && accessToken.length > 0;
  const queryClient = useQueryClient();
  const [jobTitle, setJobTitle] = useState("");

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
    () => pickActiveWorkplaceOrganization(orgsQuery.data),
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

  const jobsQuery = useQuery({
    queryKey: [...JOBS_QK, organizationId, accessToken, locale],
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
    queryKey: [...CONTACTS_QK, organizationId, accessToken, locale],
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

  const refreshHiring = () => {
    void queryClient.invalidateQueries({ queryKey: JOBS_QK });
    void queryClient.invalidateQueries({ queryKey: CONTACTS_QK });
  };

  const createJobMutation = useMutation({
    mutationFn: async (title: string) => {
      const { error } = await organizationHiringCreateJobPosting({
        client: sdk,
        path: { organizationId },
        body: { title, role: "specialist", status: "open" },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setJobTitle("");
      refreshHiring();
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
        jobTitle={jobTitle}
        setJobTitle={setJobTitle}
        isCreating={createJobMutation.isPending}
        onCreate={() => {
          const title = jobTitle.trim();
          if (title.length >= 2) createJobMutation.mutate(title);
        }}
      />
    </main>
  );
}

function JobsPanel({
  jobs,
  contacts,
  canManageHiring,
  jobTitle,
  setJobTitle,
  isCreating,
  onCreate,
}: {
  jobs: JobPosting[];
  contacts: HiringContact[];
  canManageHiring: boolean;
  jobTitle: string;
  setJobTitle: (value: string) => void;
  isCreating: boolean;
  onCreate: () => void;
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
        <div className="flex gap-2 rounded-2xl border border-border/60 bg-card p-3">
          <Input
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
            placeholder={t("jobTitlePlaceholder")}
          />
          <Button type="button" disabled={isCreating} onClick={onCreate}>
            <Plus className="size-4" aria-hidden />
            {t("createJob")}
          </Button>
        </div>
      ) : null}
      <div className="grid gap-2">
        {jobs.map((job) => (
          <Link
            key={job.id}
            href={`/business/hiring/job-postings/${job.id}`}
            className="rounded-2xl border border-border/60 bg-card px-4 py-3 transition-colors hover:bg-muted/40"
          >
            <p className="font-heading text-sm font-semibold">{job.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("jobMeta", {
                status: t(`jobStatus.${job.status}`),
                count: job.applicationsCount,
              })}
            </p>
          </Link>
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
