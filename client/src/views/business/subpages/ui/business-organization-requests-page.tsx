"use client";

import { useMemo, useState } from "react";
import { Ban, Building2, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/app/i18n/routing";
import { BusinessEmptyState } from "@/entities/business";
import { specialistMyOrganizationsQueryKey } from "@/entities/organizations";
import {
  createBrowserSdkClient,
  organizationsCabinetGetWorkplaceJoinRequestsForOrganization,
  organizationsCabinetPostReviewWorkplaceJoinRequest,
  specialistsCabinetGetSpecialistMyOrganizations,
  specialistsCabinetGetSpecialistMyWorkplaceJoinRequests,
} from "@/shared/api";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { BusinessScreenHeader } from "@/widgets/business/chrome";
import { Button } from "@/shared/ui/button";
import { cn, motion } from "@/shared/lib";

const JOIN_REQ_QK = ["specialistMyWorkplaceJoinRequests"] as const;
const ORG_INCOMING_QK = ["orgIncomingWorkplaceJoinRequests"] as const;

type RequestsTab = "outgoing" | "incoming";

function joinRequestStatusLabelKey(
  status: string,
):
  | "joinReqStatusPending"
  | "joinReqStatusAccepted"
  | "joinReqStatusRejected"
  | "joinReqStatusWithdrawn"
  | "joinReqStatusBlocked" {
  if (status === "pending") {
    return "joinReqStatusPending";
  }
  if (status === "accepted") {
    return "joinReqStatusAccepted";
  }
  if (status === "rejected") {
    return "joinReqStatusRejected";
  }
  if (status === "withdrawn") {
    return "joinReqStatusWithdrawn";
  }
  return "joinReqStatusBlocked";
}

function isOrgManagerRole(role: string): boolean {
  return role === "owner" || role === "admin";
}

type IncomingMergedRow = {
  id: string;
  organizationId: string;
  organizationName: string;
  createdAt: string;
  specialist: {
    user: {
      name: string;
      email: string;
    };
  };
};

export function BusinessOrganizationRequestsPage() {
  const t = useTranslations("businessAppSubpages");
  const locale = useLocale() as AppLocale;
  const queryClient = useQueryClient();
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken ?? "";
  const [tab, setTab] = useState<RequestsTab>("outgoing");

  const sdk = useMemo(
    () => createBrowserSdkClient(accessToken, { locale }),
    [accessToken, locale],
  );

  const authed = sessionStatus === "authenticated" && accessToken.length > 0;

  const outgoingQuery = useQuery({
    queryKey: [...JOIN_REQ_QK, accessToken, locale],
    enabled: authed,
    queryFn: async () => {
      const { data: res, error: err } = await specialistsCabinetGetSpecialistMyWorkplaceJoinRequests({
        client: sdk,
      });
      if (err || !res) {
        throw err ?? new Error("workplace-join-requests");
      }
      return res;
    },
  });

  const orgsForIncomingQuery = useQuery({
    queryKey: specialistMyOrganizationsQueryKey(accessToken, locale),
    enabled: authed && tab === "incoming",
    queryFn: async () => {
      const { data: res, error: err } = await specialistsCabinetGetSpecialistMyOrganizations({
        client: sdk,
      });
      if (err || !res) {
        throw err ?? new Error("organizations");
      }
      return res;
    },
  });

  const managedOrgs = useMemo(
    () => (orgsForIncomingQuery.data?.organizations ?? []).filter((o) => isOrgManagerRole(o.role)),
    [orgsForIncomingQuery.data?.organizations],
  );

  const incomingPerOrgQueries = useQueries({
    queries: managedOrgs.map((org) => ({
      queryKey: [...ORG_INCOMING_QK, org.id, accessToken, locale, "pending"] as const,
      enabled: authed && tab === "incoming" && managedOrgs.length > 0,
      queryFn: async () => {
        const { data: res, error: err } = await organizationsCabinetGetWorkplaceJoinRequestsForOrganization({
          client: sdk,
          path: { organizationId: org.id },
          query: { status: "pending" },
        });
        if (err || !res) {
          throw err ?? new Error("incoming-requests");
        }
        return { orgId: org.id, orgName: org.name, requests: res.requests };
      },
    })),
  });

  const incomingMerged = useMemo((): IncomingMergedRow[] => {
    const rows: IncomingMergedRow[] = [];
    for (const q of incomingPerOrgQueries) {
      const d = q.data;
      if (!d) {
        continue;
      }
      for (const r of d.requests) {
        if (r.status !== "pending") {
          continue;
        }
        rows.push({
          id: r.id,
          organizationId: r.organizationId,
          organizationName: d.orgName,
          createdAt: r.createdAt,
          specialist: r.specialist,
        });
      }
    }
    rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return rows;
  }, [incomingPerOrgQueries]);

  const incomingPerOrgPending =
    managedOrgs.length > 0 && incomingPerOrgQueries.some((q) => q.isPending);
  const incomingError =
    orgsForIncomingQuery.isError || incomingPerOrgQueries.some((q) => q.isError);

  const reviewMutation = useMutation({
    mutationFn: async (payload: {
      organizationId: string;
      requestId: string;
      decision: "accept" | "reject" | "block";
    }) => {
      const res = await organizationsCabinetPostReviewWorkplaceJoinRequest({
        client: sdk,
        path: {
          organizationId: payload.organizationId,
          requestId: payload.requestId,
        },
        body: { decision: payload.decision },
      });
      if (res.error) {
        throw res.error;
      }
      return res.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [...ORG_INCOMING_QK] });
      await queryClient.invalidateQueries({
        queryKey: specialistMyOrganizationsQueryKey(accessToken, locale),
      });
      await queryClient.invalidateQueries({ queryKey: [...JOIN_REQ_QK, accessToken, locale] });
    },
  });

  const requests = outgoingQuery.data?.requests ?? [];

  const backToOrgs = {
    href: "/business/organizations",
    ariaLabel: t("organizationRequestsBackAria"),
  } as const;

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : locale === "ru" ? "ru-RU" : "en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  );

  const refetchIncoming = () => {
    void orgsForIncomingQuery.refetch();
    for (const q of incomingPerOrgQueries) {
      void q.refetch();
    }
  };

  if (sessionStatus === "loading") {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
        <BusinessScreenHeader
          title={t("organizationRequestsTitle")}
          titleVariant="section"
          showHeadline={false}
          avatarAlt={t("organizationRequestsTitle")}
          avatarFallback="B"
          cabinetBack={backToOrgs}
        />
        <div className="h-40 animate-pulse rounded-2xl bg-muted/50" aria-busy />
      </main>
    );
  }

  if (sessionStatus === "unauthenticated" || !accessToken) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
        <BusinessScreenHeader
          title={t("organizationRequestsTitle")}
          titleVariant="section"
          showHeadline={false}
          avatarAlt={t("organizationRequestsTitle")}
          avatarFallback="B"
          cabinetBack={backToOrgs}
        />
        <BusinessEmptyState
          icon={Building2}
          title={t("orgsSignInTitle")}
          description={t("orgsSignInHint")}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
      <BusinessScreenHeader
        title={t("organizationRequestsTitle")}
        titleVariant="section"
        showHeadline={false}
        avatarAlt={t("organizationRequestsTitle")}
        avatarFallback="B"
        cabinetBack={backToOrgs}
      />

      <div
        className="flex rounded-full bg-muted p-1"
        role="tablist"
        aria-label={t("organizationRequestsTablistAria")}
      >
        {(
          [
            { id: "outgoing" as const, labelKey: "organizationRequestsTabOutgoing" as const },
            { id: "incoming" as const, labelKey: "organizationRequestsTabIncoming" as const },
          ] as const
        ).map(({ id, labelKey }) => {
          const selected = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={cn(
                motion.interactivePressStrong,
                "min-w-0 flex-1 rounded-full py-2.5 text-center text-sm font-medium transition-colors",
                selected ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setTab(id)}
            >
              {t(labelKey)}
            </button>
          );
        })}
      </div>

      <p className="text-pretty text-[0.9375rem] leading-relaxed text-foreground/85">
        {tab === "outgoing" ? t("organizationRequestsIntro") : t("organizationRequestsIntroIncoming")}
      </p>

      {tab === "outgoing" ? (
        <div role="tabpanel">
          {outgoingQuery.isPending ? (
            <div
              className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"
              aria-busy
              aria-label={t("organizationRequestsLoadingAria")}
            >
              <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden />
            </div>
          ) : outgoingQuery.isError ? (
            <div
              className="rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-foreground"
              role="alert"
            >
              <p className="font-medium">{t("organizationRequestsLoadError")}</p>
              <button
                type="button"
                className={cn(
                  motion.interactive,
                  "mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline",
                )}
                onClick={() => void outgoingQuery.refetch()}
              >
                {t("organizationRequestsRetry")}
              </button>
            </div>
          ) : requests.length === 0 ? (
            <BusinessEmptyState
              icon={Building2}
              title={t("organizationRequestsEmptyTitle")}
              description={t("organizationRequestsEmptyHint")}
            />
          ) : (
            <ul className="flex flex-col gap-2" aria-label={t("organizationRequestsListAria")}>
              {requests.map((r) => {
                const statusKey = joinRequestStatusLabelKey(r.status);
                return (
                  <li
                    key={r.id}
                    className="rounded-2xl border border-border/40 bg-card/40 px-4 py-3.5 ring-1 ring-inset ring-border/20"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 font-medium text-foreground">{r.organization.name}</p>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                          r.status === "pending" && "bg-amber-500/15 text-amber-900 dark:text-amber-100",
                          r.status === "accepted" && "bg-emerald-500/15 text-emerald-900 dark:text-emerald-100",
                          (r.status === "rejected" || r.status === "blocked") &&
                            "bg-destructive/10 text-destructive",
                          r.status === "withdrawn" && "bg-muted text-muted-foreground",
                        )}
                      >
                        {t(statusKey)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("organizationRequestsSentAt", {
                        date: dateFmt.format(new Date(r.createdAt)),
                      })}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div role="tabpanel">
          {reviewMutation.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {t("organizationIncomingReviewError")}
            </p>
          ) : null}
          {orgsForIncomingQuery.isPending ? (
            <div
              className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"
              aria-busy
              aria-label={t("organizationIncomingLoadingAria")}
            >
              <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden />
            </div>
          ) : incomingError ? (
            <div className="rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-foreground" role="alert">
              <p className="font-medium">{t("organizationIncomingLoadError")}</p>
              <button
                type="button"
                className={cn(
                  motion.interactive,
                  "mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline",
                )}
                onClick={() => {
                  reviewMutation.reset();
                  void refetchIncoming();
                }}
              >
                {t("organizationIncomingRetry")}
              </button>
            </div>
          ) : managedOrgs.length === 0 ? (
            <BusinessEmptyState
              icon={Building2}
              title={t("organizationIncomingNoOrgsTitle")}
              description={t("organizationIncomingNoOrgsHint")}
            />
          ) : incomingPerOrgPending ? (
            <div
              className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"
              aria-busy
              aria-label={t("organizationIncomingLoadingAria")}
            >
              <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden />
            </div>
          ) : incomingMerged.length === 0 ? (
            <BusinessEmptyState
              icon={Building2}
              title={t("organizationIncomingEmptyTitle")}
              description={t("organizationIncomingEmptyHint")}
            />
          ) : (
            <ul className="flex flex-col gap-2" aria-label={t("organizationIncomingListAria")}>
              {incomingMerged.map((r) => {
                const rowBusy =
                  reviewMutation.isPending && reviewMutation.variables?.requestId === r.id;
                return (
                  <li
                    key={`${r.organizationId}-${r.id}`}
                    className="rounded-2xl border border-border/40 bg-card/40 px-4 py-3.5 ring-1 ring-inset ring-border/20"
                  >
                    <p className="text-xs font-medium text-muted-foreground">{r.organizationName}</p>
                    <p className="mt-1 font-medium text-foreground">{r.specialist.user.name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{r.specialist.user.email}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("organizationIncomingReceivedAt", {
                        date: dateFmt.format(new Date(r.createdAt)),
                      })}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        className="h-10 min-w-0 flex-1 rounded-xl px-3 text-sm font-medium sm:flex-none"
                        disabled={rowBusy}
                        onClick={() =>
                          reviewMutation.mutate({
                            organizationId: r.organizationId,
                            requestId: r.id,
                            decision: "accept",
                          })
                        }
                      >
                        {rowBusy && reviewMutation.variables?.decision === "accept" ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          t("incomingAccept")
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        tone="light"
                        className="h-10 min-w-0 flex-1 rounded-xl border border-border px-3 text-sm font-medium sm:flex-none"
                        disabled={rowBusy}
                        onClick={() =>
                          reviewMutation.mutate({
                            organizationId: r.organizationId,
                            requestId: r.id,
                            decision: "reject",
                          })
                        }
                      >
                        {rowBusy && reviewMutation.variables?.decision === "reject" ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          t("incomingReject")
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 shrink-0 rounded-xl border border-border bg-transparent text-destructive hover:bg-transparent hover:text-destructive"
                        aria-label={t("incomingBlock")}
                        disabled={rowBusy}
                        onClick={() => {
                          if (!window.confirm(t("incomingBlockConfirm"))) {
                            return;
                          }
                          reviewMutation.mutate({
                            organizationId: r.organizationId,
                            requestId: r.id,
                            decision: "block",
                          });
                        }}
                      >
                        {rowBusy && reviewMutation.variables?.decision === "block" ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Ban className="size-4 shrink-0" aria-hidden />
                        )}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}
