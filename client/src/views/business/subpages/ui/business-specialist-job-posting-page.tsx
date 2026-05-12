"use client";

import { useMemo } from "react";
import { BriefcaseBusiness, Check, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
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
  organizationHiringListApplications,
  organizationHiringListJobPostings,
  organizationHiringReviewApplication,
  specialistsCabinetGetSpecialistMyOrganizations,
} from "@/shared/api";
import type {
  OrganizationHiringListApplicationsResponse,
  OrganizationHiringListJobPostingsResponse,
} from "@/shared/api/generated/sdk/types.gen";
import { Button } from "@/shared/ui";
import { Skeleton } from "@/shared/ui/shadcn/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const JOB_DETAIL_QK = ["businessSpecialistJobPosting"] as const;
const JOB_CONTACTS_QK = ["businessSpecialistJobContacts"] as const;

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
    () => pickActiveWorkplaceOrganization(orgsQuery.data),
    [orgsQuery.data],
  );
  const organizationId = activeOrg?.id ?? "";
  const canAccept = canOrganization(
    activeOrg,
    OrganizationCapabilities.HIRING_ACCEPT,
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
      </section>

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
