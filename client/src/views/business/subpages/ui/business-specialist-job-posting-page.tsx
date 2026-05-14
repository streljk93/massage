"use client";

import { useMemo, useState } from "react";
import { BriefcaseBusiness, Check, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
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
  organizationsCabinetGetCabinetOrganizationProfileForEdit,
  organizationHiringListApplications,
  organizationHiringListJobPostings,
  organizationHiringPatchJobPosting,
  organizationHiringReviewApplication,
  specialistsCabinetGetSpecialistMyOrganizations,
} from "@/shared/api";
import type {
  OrganizationHiringListApplicationsResponse,
  OrganizationHiringListJobPostingsResponse,
} from "@/shared/api/generated/sdk/types.gen";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/shared/ui";
import { Skeleton } from "@/shared/ui/shadcn/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServiceCategories } from "../model/use-service-categories";

const JOB_DETAIL_QK = ["businessSpecialistJobPosting"] as const;
const JOB_CONTACTS_QK = ["businessSpecialistJobContacts"] as const;
const CABINET_PROFILE_QK = ["businessHiringJobCabinetProfile"] as const;
const NONE_VALUE = "__none__";

type JobPosting =
  OrganizationHiringListJobPostingsResponse["jobPostings"][number];
type HiringContact =
  OrganizationHiringListApplicationsResponse["contacts"][number];

export function BusinessSpecialistJobPostingPage() {
  const t = useTranslations("businessSpecialistJobPostingPage");
  useSetBusinessPageTitle(t("title"));
  const locale = useLocale() as AppLocale;
  const params = useParams<{ jobPostingId: string }>();
  const jobPostingId = params.jobPostingId ?? "";
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
  const canAccept = canOrganization(
    activeOrg,
    OrganizationCapabilities.HIRING_ACCEPT,
  );
  const canManage = canOrganization(
    activeOrg,
    OrganizationCapabilities.HIRING_MANAGE,
  );

  const jobsQuery = useQuery({
    queryKey: [...JOB_DETAIL_QK, organizationId, accessToken, locale],
    enabled: authed && organizationId.length > 0,
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
    queryKey: [...JOB_CONTACTS_QK, organizationId, accessToken, locale],
    enabled: authed && organizationId.length > 0,
    queryFn: async () => {
      const { data, error } = await organizationHiringListApplications({
        client: sdk,
        path: { organizationId },
      });
      if (error || !data) throw error ?? new Error("contacts");
      return data;
    },
  });

  const cabinetProfileQuery = useQuery({
    queryKey: [...CABINET_PROFILE_QK, organizationId, locale],
    enabled: authed && organizationId.length > 0 && canManage,
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

  const categoriesQuery = useServiceCategories({
    sdk,
    locale,
    majorCategorySlugs: cabinetProfileQuery.data?.majorCategorySlugs ?? [],
  });

  const reviewMutation = useMutation({
    mutationFn: async ({
      contactId,
      decision,
    }: {
      contactId: string;
      decision: "accepted" | "rejected";
    }) => {
      const { error } = await organizationHiringReviewApplication({
        client: sdk,
        path: { organizationId, contactId },
        body: { decision },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: JOB_CONTACTS_QK });
    },
  });

  const patchJobMutation = useMutation({
    mutationFn: async (body: {
      title: string;
      serviceCategoryId: string | null;
      experienceMinYears: number | null;
      requirements: string | null;
      description: string | null;
      status: "draft" | "open" | "closed";
    }) => {
      const { error } = await organizationHiringPatchJobPosting({
        client: sdk,
        path: { organizationId, jobPostingId },
        body: { ...body, role: "specialist" },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: JOB_DETAIL_QK });
    },
  });

  if (sessionStatus === "loading" || orgsQuery.isPending || jobsQuery.isPending) {
    return (
      <main className="flex flex-1 flex-col gap-3 px-4 pt-2">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </main>
    );
  }

  const job = jobsQuery.data?.jobPostings.find((item) => item.id === jobPostingId);
  if (!authed || activeOrg == null || job == null) {
    return (
      <main className="flex flex-1 flex-col px-4 pt-2">
        <BusinessEmptyState
          icon={BriefcaseBusiness}
          title={t("emptyTitle")}
          description={t("emptyHint")}
        />
      </main>
    );
  }

  const contacts =
    contactsQuery.data?.contacts.filter((contact) => contact.jobPostingId === job.id) ??
    [];

  return (
    <main className="flex flex-1 flex-col gap-4 px-4 pt-2 pb-6">
      <section className="rounded-2xl border border-border/60 bg-card p-4">
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="mt-1 font-heading text-xl font-semibold">{job.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("jobMeta", {
            status: t(`jobStatus.${job.status}`),
            count: job.applicationsCount,
          })}
        </p>
        {job.serviceCategoryName || job.experienceMinYears != null ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {job.serviceCategoryName ?? t("categoryMissing")} ·{" "}
            {job.experienceMinYears == null ?
              t("experienceAny")
            : t("experienceFrom", { years: job.experienceMinYears })}
          </p>
        ) : null}
        {job.description ? (
          <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
            {job.description}
          </p>
        ) : null}
        {job.requirements ? (
          <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
            {job.requirements}
          </p>
        ) : null}
      </section>

      {canManage ? (
        <JobPostingEditForm
          key={job.id}
          job={job}
          categories={categoriesQuery.data ?? []}
          categoriesLoading={categoriesQuery.isPending}
          disabled={patchJobMutation.isPending}
          onSubmit={(body) => patchJobMutation.mutate(body)}
        />
      ) : null}

      <section className="grid gap-2">
        {contacts.map((contact) => (
          <ContactRow
            key={contact.id}
            contact={contact}
            canAccept={canAccept}
            disabled={reviewMutation.isPending}
            onDecision={(decision) =>
              reviewMutation.mutate({ contactId: contact.id, decision })
            }
          />
        ))}
        {!contactsQuery.isPending && contacts.length === 0 ? (
          <BusinessEmptyState
            icon={BriefcaseBusiness}
            title={t("noContactsTitle")}
            description={t("noContactsHint")}
          />
        ) : null}
      </section>
    </main>
  );
}

function JobPostingEditForm({
  job,
  categories,
  categoriesLoading,
  disabled,
  onSubmit,
}: {
  job: JobPosting;
  categories: { id: string; label: string }[];
  categoriesLoading: boolean;
  disabled: boolean;
  onSubmit: (body: {
    title: string;
    serviceCategoryId: string | null;
    experienceMinYears: number | null;
    requirements: string | null;
    description: string | null;
    status: "draft" | "open" | "closed";
  }) => void;
}) {
  const t = useTranslations("businessSpecialistJobPostingPage");
  const [title, setTitle] = useState(job.title);
  const [categoryId, setCategoryId] = useState(
    job.serviceCategoryId ?? NONE_VALUE,
  );
  const [experience, setExperience] = useState(
    job.experienceMinYears == null ? NONE_VALUE : String(job.experienceMinYears),
  );
  const [requirements, setRequirements] = useState(job.requirements ?? "");
  const [description, setDescription] = useState(job.description ?? "");
  const [status, setStatus] = useState<JobPosting["status"]>(job.status);

  const canSubmit = title.trim().length >= 2 && !disabled;

  return (
    <section className="grid gap-3 rounded-2xl border border-border/60 bg-card p-4">
      <div>
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">
          {t("editEyebrow")}
        </p>
        <h2 className="mt-1 font-heading text-lg font-semibold">
          {t("editTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("editHint")}</p>
      </div>

      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={t("jobTitlePlaceholder")}
      />

      <div className="grid gap-2 sm:grid-cols-2">
        <Select
          value={categoryId}
          onValueChange={setCategoryId}
          disabled={categoriesLoading}
        >
          <SelectTrigger className="rounded-xl bg-background">
            <SelectValue placeholder={t("categoryPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE}>{t("categoryNone")}</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={experience} onValueChange={setExperience}>
          <SelectTrigger className="rounded-xl bg-background">
            <SelectValue placeholder={t("experiencePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE}>{t("experienceAny")}</SelectItem>
            <SelectItem value="0">{t("experienceOption.0")}</SelectItem>
            <SelectItem value="1">{t("experienceOption.1")}</SelectItem>
            <SelectItem value="3">{t("experienceOption.3")}</SelectItem>
            <SelectItem value="5">{t("experienceOption.5")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Textarea
        value={requirements}
        onChange={(event) => setRequirements(event.target.value)}
        placeholder={t("requirementsPlaceholder")}
      />
      <Textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder={t("descriptionPlaceholder")}
      />

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as JobPosting["status"])}
        >
          <SelectTrigger className="rounded-xl bg-background">
            <SelectValue placeholder={t("statusPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">{t("jobStatus.draft")}</SelectItem>
            <SelectItem value="open">{t("jobStatus.open")}</SelectItem>
            <SelectItem value="closed">{t("jobStatus.closed")}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          disabled={disabled || !canSubmit}
          onClick={() =>
            onSubmit({
              title: title.trim(),
              serviceCategoryId:
                categoryId === NONE_VALUE ? null : categoryId,
              experienceMinYears:
                experience === NONE_VALUE ? null : Number(experience),
              requirements: requirements.trim() || null,
              description: description.trim() || null,
              status,
            })
          }
        >
          {disabled ? t("saving") : t("save")}
        </Button>
      </div>
    </section>
  );
}

function ContactRow({
  contact,
  canAccept,
  disabled,
  onDecision,
}: {
  contact: HiringContact;
  canAccept: boolean;
  disabled: boolean;
  onDecision: (decision: "accepted" | "rejected") => void;
}) {
  const t = useTranslations("businessSpecialistJobPostingPage");
  return (
    <article className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3">
      <div>
        <p className="font-heading text-sm font-semibold">
          {t(`contactSource.${contact.source}`)}
        </p>
        <p className="text-xs text-muted-foreground">
          {t(`contactStatus.${contact.status}`)}
        </p>
        {contact.application?.message ? (
          <p className="mt-1 max-w-xl text-xs text-muted-foreground">
            {contact.application.message}
          </p>
        ) : null}
      </div>
      {canAccept && contact.status === "pending" ? (
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            disabled={disabled}
            onClick={() => onDecision("accepted")}
          >
            <Check className="size-4" aria-hidden />
            {t("accept")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={disabled}
            onClick={() => onDecision("rejected")}
          >
            <X className="size-4" aria-hidden />
            {t("reject")}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
