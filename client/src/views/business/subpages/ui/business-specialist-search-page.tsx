"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, UserRound } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/app/i18n/routing";
import { Link } from "@/app/i18n/navigation";
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
  organizationHiringListJobPostings,
  specialistsCabinetGetSpecialistMyOrganizations,
} from "@/shared/api";
import type {
  HiringListCandidatesResponse,
} from "@/shared/api/generated/sdk/types.gen";
import { cn, motion } from "@/shared/lib";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui";
import { Skeleton } from "@/shared/ui/shadcn/skeleton";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

const CANDIDATES_QK = ["businessSpecialistCandidates"] as const;
const SEARCH_JOBS_QK = ["businessSpecialistSearchJobs"] as const;

type Candidate = HiringListCandidatesResponse["candidates"][number];

export function BusinessSpecialistSearchPage() {
  const t = useTranslations("businessSpecialistSearchPage");
  useSetBusinessPageTitle(t("title"));
  const locale = useLocale() as AppLocale;
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken ?? "";
  const authed = sessionStatus === "authenticated" && accessToken.length > 0;
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedJobPostingId, setSelectedJobPostingId] = useState<string>(
    () => searchParams.get("jobPostingId") ?? "",
  );

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

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

  const jobsQuery = useQuery({
    queryKey: [...SEARCH_JOBS_QK, organizationId, accessToken, locale],
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

  const effectiveJobPostingId =
    selectedJobPostingId || jobsQuery.data?.jobPostings[0]?.id || "";

  const candidatesQuery = useInfiniteQuery({
    queryKey: [
      ...CANDIDATES_QK,
      accessToken,
      locale,
      debouncedSearch,
      effectiveJobPostingId,
    ],
    enabled: authed && canViewHiring,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await hiringListCandidates({
        client: sdk,
        query: {
          q: debouncedSearch || undefined,
          limit: 20,
          cursor: pageParam,
          jobPostingId: effectiveJobPostingId || undefined,
        },
      });
      if (error || !data) throw error ?? new Error("candidates");
      return data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  if (sessionStatus === "loading" || orgsQuery.isPending) {
    return (
      <main className="flex flex-1 flex-col gap-3 px-4 pt-2">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </main>
    );
  }

  if (!authed || activeOrg == null || !canViewHiring) {
    return (
      <main className="flex flex-1 flex-col px-4 pt-2">
        <BusinessEmptyState
          icon={UserRound}
          title={t("emptyTitle")}
          description={t("emptyHint")}
        />
      </main>
    );
  }

  const candidates =
    candidatesQuery.data?.pages.flatMap((page) => page.candidates) ?? [];
  const jobPostings = jobsQuery.data?.jobPostings ?? [];

  return (
    <main className="flex flex-1 flex-col gap-4 px-4 pt-2 pb-6">
      <section className="rounded-2xl border border-border/60 bg-card p-4">
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="mt-1 font-heading text-xl font-semibold">
          {t("heroTitle")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("heroHint")}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_14rem]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-9"
            />
          </div>
          <Select
            value={effectiveJobPostingId}
            onValueChange={setSelectedJobPostingId}
          >
            <SelectTrigger className="rounded-xl bg-background">
              <SelectValue placeholder={t("jobPostingPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {jobPostings.map((job) => (
                <SelectItem key={job.id} value={job.id}>
                  {job.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="grid gap-2">
        {jobPostings.length === 0 && debouncedSearch.length === 0 ? (
          <BusinessEmptyState
            icon={Search}
            title={t("noJobPostingsTitle")}
            description={t("noJobPostingsHint")}
          />
        ) : null}
        {candidates.map((candidate) => (
          <CandidateCard
            key={candidate.specialistId}
            candidate={candidate}
          />
        ))}
        {!candidatesQuery.isPending && candidates.length === 0 ? (
          <BusinessEmptyState
            icon={Search}
            title={t("noResultsTitle")}
            description={t("noResultsHint")}
          />
        ) : null}
        {candidatesQuery.hasNextPage ? (
          <Button
            type="button"
            variant="secondary"
            disabled={candidatesQuery.isFetchingNextPage}
            onClick={() => void candidatesQuery.fetchNextPage()}
          >
            {t("loadMore")}
          </Button>
        ) : null}
      </section>
    </main>
  );
}

function CandidateCard({
  candidate,
}: {
  candidate: Candidate;
}) {
  const t = useTranslations("businessSpecialistSearchPage");
  return (
    <article className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3">
      <Link
        href={`/specialists/${candidate.specialistId}`}
        className={cn(motion.interactive, "flex min-w-0 flex-1 items-center gap-3")}
      >
        <Avatar className="size-11">
          {candidate.imageUrl ? <AvatarImage src={candidate.imageUrl} alt="" /> : null}
          <AvatarFallback>
            <UserRound className="size-5" aria-hidden />
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-sm font-semibold">
            {candidate.displayName ?? candidate.specialistId}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {candidate.experienceYears == null ?
              t("experienceUnknown")
            : t("candidateExperience", { years: candidate.experienceYears })}
            {" · "}
            {candidate.headline ?? candidate.summary ?? t("candidateNoHeadline")}
          </p>
        </div>
        <span className="text-xs font-semibold text-primary">
          {t("matchScore", { score: Math.round(candidate.matchScore * 100) })}
        </span>
      </Link>
    </article>
  );
}
