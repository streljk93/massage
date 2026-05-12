"use client";

import {
  Building2,
  ChevronDown,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
  UserPlus,
} from "lucide-react";
import { parseISO } from "date-fns";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Link } from "@/app/i18n/navigation";
import type { AppLocale } from "@/app/i18n/routing";
import { BusinessEmptyState } from "@/entities/business";
import { useSetBusinessPageTitle } from "@/widgets/business/chrome";
import {
  OrganizationCapabilities,
  canOrganization,
  displayNameForCabinetOrganization,
  specialistMyOrganizationsQueryKey,
  SPECIALIST_MY_ORGANIZATIONS_QUERY_KEY_PREFIX,
} from "@/entities/organizations";
import {
  createBrowserSdkClient,
  organizationsCabinetDeleteOrganizationAsOwner,
  organizationsCabinetGetDeleteOrganizationBookingsPreview,
  organizationsCabinetGetWorkplaceJoinRequestsForOrganization,
  organizationsCabinetPostReviewWorkplaceJoinRequest,
  specialistOrganizationInvitationsListMyOrganizationInvitations,
  specialistOrganizationInvitationsRespondMyOrganizationInvitation,
  specialistsCabinetGetSpecialistActiveOrganizationBookingsPreview,
  specialistsCabinetGetSpecialistMyOrganizations,
  specialistsCabinetPatchSpecialistActiveOrganization,
  type OrganizationsCabinetGetDeleteOrganizationBookingsPreviewResponse,
  type SpecialistsCabinetGetSpecialistActiveOrganizationBookingsPreviewResponse,
} from "@/shared/api";
import { confirmAction, notify } from "@/shared/lib/notifications";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Separator,
  Switch,
} from "@/shared/ui";
import { cn, motion, previewSrcForPersistedGalleryUrl } from "@/shared/lib";

const ONB_QK = ["specialistOnboarding"] as const;
const ORG_INCOMING_QK = ["orgIncomingWorkplaceJoinRequests"] as const;
const JOIN_REQ_QK = ["specialistMyWorkplaceJoinRequests"] as const;
const ORG_INVITES_QK = ["specialistOrganizationInvitations"] as const;

function orgRoleLabelKey(role: string): "orgRoleOwner" | "orgRoleAdmin" | "orgRoleSpecialist" {
  if (role === "owner") {
    return "orgRoleOwner";
  }
  if (role === "admin") {
    return "orgRoleAdmin";
  }
  return "orgRoleSpecialist";
}

const ORG_BOOKINGS_CONFIRM_TZ = "Asia/Ho_Chi_Minh";

type OrgSwitchAwayPreviewBooking =
  SpecialistsCabinetGetSpecialistActiveOrganizationBookingsPreviewResponse["bookings"][number];

function OrgSwitchWorkplaceBookingsConfirmBody({
  rows,
}: {
  rows: OrgSwitchAwayPreviewBooking[];
}) {
  const t = useTranslations("businessAppSubpages");
  const format = useFormatter();

  return (
    <div className="min-w-0 w-full space-y-2 pt-1 text-foreground">
      <p className="min-w-0 max-w-full text-destructive text-pretty text-sm leading-snug break-words">
        {t("orgSwitchWorkplaceCancelAutoFootnote")}
      </p>
      <ul
        className="max-h-44 w-full min-w-0 max-w-full list-none divide-y divide-border overflow-y-auto overflow-x-hidden rounded-lg border border-border/70 bg-card p-0 shadow-sm overscroll-contain"
        role="list"
        aria-label={t("orgSwitchWorkplaceBookingsListAria")}
      >
        {rows.map((row) => {
          const start = parseISO(row.startsAt);
          const end = parseISO(row.endsAt);
          const dateLine = `${format.dateTime(start, {
            dateStyle: "short",
            timeZone: ORG_BOOKINGS_CONFIRM_TZ,
          })} ${format.dateTime(start, {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: ORG_BOOKINGS_CONFIRM_TZ,
          })}–${format.dateTime(end, {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: ORG_BOOKINGS_CONFIRM_TZ,
          })}`;
          return (
            <li key={row.id} className="min-w-0 px-2 py-1.5 text-left">
              <div className="min-w-0 truncate text-[0.8125rem] leading-tight font-medium">
                {row.clientDisplayName}
              </div>
              <div className="mt-px min-w-0 truncate text-[0.6875rem] leading-snug text-muted-foreground tabular-nums">
                <span>{dateLine}</span>
                <span className="text-muted-foreground/50"> · </span>
                <span>
                  {t("orgSwitchWorkplaceBookingMeta", {
                    category: row.categoryShortName,
                    duration: row.durationMinutes,
                    status: row.statusLabel,
                  })}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type OrgDeletePreviewBookingRow =
  OrganizationsCabinetGetDeleteOrganizationBookingsPreviewResponse["bookings"][number];

function OrgDeleteOrganizationBookingsConfirmBody({
  rows,
}: {
  rows: OrgDeletePreviewBookingRow[];
}) {
  const t = useTranslations("businessAppSubpages");
  const format = useFormatter();

  return (
    <div className="min-w-0 w-full space-y-2 pt-1 text-foreground">
      <p className="min-w-0 max-w-full text-destructive text-pretty text-sm leading-snug break-words">
        {t("orgDeleteActiveBookingsFootnote")}
      </p>
      <ul
        className="max-h-44 w-full min-w-0 max-w-full list-none divide-y divide-border overflow-y-auto overflow-x-hidden rounded-lg border border-border/70 bg-card p-0 shadow-sm overscroll-contain"
        role="list"
        aria-label={t("orgDeleteBookingsListAria")}
      >
        {rows.map((row) => {
          const start = parseISO(row.startsAt);
          const end = parseISO(row.endsAt);
          const dateLine = `${format.dateTime(start, {
            dateStyle: "short",
            timeZone: ORG_BOOKINGS_CONFIRM_TZ,
          })} ${format.dateTime(start, {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: ORG_BOOKINGS_CONFIRM_TZ,
          })}–${format.dateTime(end, {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: ORG_BOOKINGS_CONFIRM_TZ,
          })}`;
          return (
            <li key={row.id} className="min-w-0 px-2 py-1.5 text-left">
              <div className="min-w-0 truncate text-[0.8125rem] leading-tight font-medium">
                {row.clientDisplayName}
              </div>
              <div className="mt-px min-w-0 truncate text-[0.6875rem] leading-snug text-muted-foreground">
                {t("orgDeletePreviewSpecialist", { name: row.specialistDisplayName })}
              </div>
              <div className="mt-px min-w-0 truncate text-[0.6875rem] leading-snug text-muted-foreground tabular-nums">
                <span>{dateLine}</span>
                <span className="text-muted-foreground/50"> · </span>
                <span>
                  {t("orgSwitchWorkplaceBookingMeta", {
                    category: row.categoryShortName,
                    duration: row.durationMinutes,
                    status: row.statusLabel,
                  })}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function BusinessOrganizationsPage() {
  const t = useTranslations("businessAppSubpages");
  useSetBusinessPageTitle(t("organizationsTitle"));
  const format = useFormatter();
  const locale = useLocale() as AppLocale;
  const queryClient = useQueryClient();
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken ?? "";

  const sdk = useMemo(
    () => createBrowserSdkClient(accessToken, { locale }),
    [accessToken, locale],
  );

  const [previewSwitchAwayBusy, setPreviewSwitchAwayBusy] = useState(false);
  const [deleteOrganizationFlowBusyOrgId, setDeleteOrganizationFlowBusyOrgId] = useState<string | null>(
    null,
  );

  const deleteOrganizationMutation = useMutation({
    mutationFn: async (organizationId: string) => {
      const { data: res, error } = await organizationsCabinetDeleteOrganizationAsOwner({
        client: sdk,
        path: { organizationId },
      });
      if (error || !res) {
        throw error ?? new Error("delete-org");
      }
      return res;
    },
    onSuccess: async (res) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...SPECIALIST_MY_ORGANIZATIONS_QUERY_KEY_PREFIX] }),
        queryClient.invalidateQueries({ queryKey: [...ONB_QK] }),
        queryClient.invalidateQueries({ queryKey: ["specialistSalonBookings"] }),
      ]);
      if (res.cancelledBookingsCount > 0) {
        notify.success(
          t("orgDeleteDoneTitle"),
          t("orgDeleteCancelledBookingsToast", { count: res.cancelledBookingsCount }),
        );
      } else {
        notify.success(t("orgDeleteDoneTitle"));
      }
    },
    onError: () => {
      notify.error(t("orgDeleteOrganizationError"));
    },
  });

  const setActiveWorkplaceMutation = useMutation({
    mutationFn: async (organizationId: string | null) => {
      const { data: res, error } = await specialistsCabinetPatchSpecialistActiveOrganization({
        client: sdk,
        body: { organizationId },
      });
      if (error || !res) {
        throw error ?? new Error("active-organization");
      }
      return res;
    },
    onSuccess: async (res, organizationId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...SPECIALIST_MY_ORGANIZATIONS_QUERY_KEY_PREFIX] }),
        queryClient.invalidateQueries({ queryKey: [...ONB_QK] }),
        queryClient.invalidateQueries({ queryKey: ["specialistSalonBookings"] }),
      ]);
      const cancelled = res.cancelledBookingsCount;
      if (organizationId === null) {
        if (cancelled > 0) {
          notify.success(
            t("orgClearWorkplaceDoneTitle"),
            t("orgSwitchWorkplaceCancelledBookings", { count: cancelled }),
          );
        } else {
          notify.success(t("orgClearWorkplaceDoneTitle"));
        }
        return;
      }
      if (cancelled > 0) {
        notify.success(
          t("orgSwitchWorkplaceDoneTitle"),
          t("orgSwitchWorkplaceCancelledBookings", { count: cancelled }),
        );
      } else {
        notify.success(t("orgSwitchWorkplaceDoneTitle"));
      }
    },
    onError: (_err, organizationId) => {
      notify.error(
        organizationId === null ? t("orgClearWorkplaceError") : t("orgSwitchWorkplaceError"),
      );
    },
  });

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: specialistMyOrganizationsQueryKey(accessToken, locale),
    enabled:
      sessionStatus === "authenticated" && typeof accessToken === "string" && accessToken.length > 0,
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

  const organizations = data?.organizations ?? [];
  const activeWorkplaceId =
    data != null &&
    typeof data.activeOrganizationId === "string" &&
    data.activeOrganizationId.length > 0 ?
      data.activeOrganizationId
    : null;

  const managedOrgs = useMemo(() => {
    const orgs = data?.organizations ?? [];
    return orgs.filter(
      (o) =>
        o.membershipStatus === "employed" &&
        canOrganization(o, OrganizationCapabilities.JOIN_REQUESTS_REVIEW),
    );
  }, [data]);

  const authed = sessionStatus === "authenticated" && accessToken.length > 0;

  const organizationInvitesQuery = useQuery({
    queryKey: [...ORG_INVITES_QK, accessToken, locale] as const,
    enabled: authed,
    queryFn: async () => {
      const { data, error } =
        await specialistOrganizationInvitationsListMyOrganizationInvitations({ client: sdk });
      if (error || !data) {
        return { invitations: [] };
      }
      return data;
    },
  });

  const pendingOrganizationInvites = useMemo(() => {
    const invitations = organizationInvitesQuery.data?.invitations ?? [];
    return invitations.filter((inv) => inv.status === "pending");
  }, [organizationInvitesQuery.data]);

  const respondOrganizationInviteMutation = useMutation({
    mutationFn: async (args: { invitationId: string; decision: "accept" | "reject" }) => {
      const { data, error } =
        await specialistOrganizationInvitationsRespondMyOrganizationInvitation({
          client: sdk,
          path: { invitationId: args.invitationId },
          body: { decision: args.decision },
        });
      if (error || !data) {
        throw error ?? new Error("respond-invite");
      }
      return { ...args };
    },
    onSuccess: async (_res, vars) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...SPECIALIST_MY_ORGANIZATIONS_QUERY_KEY_PREFIX] }),
        queryClient.invalidateQueries({ queryKey: [...ORG_INVITES_QK] }),
      ]);
      notify.success(
        vars.decision === "accept" ?
          t("orgTeamInviteAccepted")
        : t("orgTeamInviteRejected"),
      );
    },
    onError: () => {
      notify.error(t("orgTeamInviteRespondError"));
    },
  });

  const incomingPerOrgQueries = useQueries({
    queries: managedOrgs.map((org) => ({
      queryKey: [...ORG_INCOMING_QK, org.id, accessToken, locale, "pending"] as const,
      enabled: authed && managedOrgs.length > 0,
      queryFn: async () => {
        const { data: res, error: err } =
          await organizationsCabinetGetWorkplaceJoinRequestsForOrganization({
            client: sdk,
            path: { organizationId: org.id },
            query: { status: "pending" },
          });
        if (err || !res) {
          throw err ?? new Error("incoming-requests");
        }
        return { orgId: org.id, requests: res.requests };
      },
    })),
  });

  const reviewJoinRequestMutation = useMutation({
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...ORG_INCOMING_QK] }),
        queryClient.invalidateQueries({
          queryKey: specialistMyOrganizationsQueryKey(accessToken, locale),
        }),
        queryClient.invalidateQueries({
          queryKey: [...JOIN_REQ_QK, accessToken, locale],
        }),
      ]);
    },
    onError: () => {
      notify.error(t("organizationIncomingReviewError"));
    },
  });

  const showEmpty =
    sessionStatus === "authenticated" &&
    accessToken.length > 0 &&
    !isPending &&
    !isError &&
    organizations.length === 0;

  const showList = organizations.length > 0;

  const requestDeleteOrganization = async (organizationId: string) => {
    if (
      deleteOrganizationMutation.isPending ||
      deleteOrganizationFlowBusyOrgId != null
    ) {
      return;
    }
    setDeleteOrganizationFlowBusyOrgId(organizationId);
    try {
      const preview =
        await organizationsCabinetGetDeleteOrganizationBookingsPreview({
          client: sdk,
          path: { organizationId },
          query: { locale },
        });
      if (preview.error || !preview.data) {
        notify.error(t("orgDeletePreviewLoadError"));
        return;
      }
      const rows = preview.data.bookings;
      const ok = await confirmAction({
        title: t("orgDeleteConfirmTitle"),
        body: (
          <div className="min-w-0 w-full space-y-3 pt-1 text-left">
            <p className="text-pretty text-sm leading-snug text-foreground">
              {t("orgDeleteConfirmDescription")}
            </p>
            {rows.length > 0 ? <OrgDeleteOrganizationBookingsConfirmBody rows={rows} /> : null}
          </div>
        ),
        confirmLabel: t("orgDeleteConfirmAction"),
        cancelLabel: t("orgDeleteConfirmBack"),
        destructive: true,
      });
      if (!ok) {
        return;
      }
      await deleteOrganizationMutation.mutateAsync(organizationId);
    } finally {
      setDeleteOrganizationFlowBusyOrgId(null);
    }
  };

  return (
    <main className="flex w-full min-h-0 flex-1 flex-col gap-5 px-4 pt-2">
      {sessionStatus === "authenticated" && accessToken.length > 0 ?
        <div className="flex w-full min-w-0 flex-row flex-wrap items-stretch gap-2">
          <Button
            variant="secondary"
            tone="light"
            className="h-11 min-w-0 flex-1 rounded-xl border border-border px-3 text-[0.9375rem] font-medium sm:px-5"
            asChild
          >
            <Link href="/business/organizations/join">{t("findJoinOrganization")}</Link>
          </Button>
          <Button
            variant="primary"
            className="h-11 min-w-0 flex-1 rounded-xl px-3 text-[0.9375rem] font-medium sm:px-5"
            asChild
          >
            <Link href="/business/organizations/new">{t("createOrganization")}</Link>
          </Button>
        </div>
      : null}

      {authed && pendingOrganizationInvites.length > 0 ?
        <section
          className="flex flex-col gap-3"
          aria-label={t("orgTeamInviteSectionAria")}
        >
          <ul className="m-0 flex list-none flex-col gap-3 p-0" role="list">
            {pendingOrganizationInvites.map((inv) => {
              const name =
                typeof inv.organizationName === "string" && inv.organizationName.trim().length > 0 ?
                  inv.organizationName.trim()
                : t("orgTeamInviteOrganizationFallback");
              const rowBusy =
                respondOrganizationInviteMutation.isPending &&
                respondOrganizationInviteMutation.variables?.invitationId === inv.id;
              return (
                <li key={inv.id}>
                  <article className="overflow-hidden rounded-2xl border border-primary/35 bg-card shadow-sm ring-1 ring-border/30">
                    <div className="flex gap-3.5 p-4">
                      <div
                        className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary"
                        aria-hidden
                      >
                        <UserPlus className="size-6 opacity-90" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-heading text-base font-semibold leading-snug tracking-tight text-foreground">
                          {name}
                        </h3>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {t("orgTeamInviteTitle")}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="primary"
                            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium"
                            disabled={
                              rowBusy ||
                              deleteOrganizationMutation.isPending ||
                              deleteOrganizationFlowBusyOrgId != null
                            }
                            onClick={() =>
                              respondOrganizationInviteMutation.mutate({
                                invitationId: inv.id,
                                decision: "accept",
                              })
                            }
                          >
                            {rowBusy && respondOrganizationInviteMutation.variables?.decision === "accept" ?
                              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                            : null}
                            <span>{t("incomingAccept")}</span>
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            tone="light"
                            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-medium"
                            disabled={
                              rowBusy ||
                              deleteOrganizationMutation.isPending ||
                              deleteOrganizationFlowBusyOrgId != null
                            }
                            onClick={() =>
                              respondOrganizationInviteMutation.mutate({
                                invitationId: inv.id,
                                decision: "reject",
                              })
                            }
                          >
                            {rowBusy && respondOrganizationInviteMutation.variables?.decision === "reject" ?
                              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                            : null}
                            <span>{t("incomingReject")}</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        </section>
      : null}

      {sessionStatus === "loading" ? (
        <div className="space-y-3" aria-busy aria-label={t("orgsLoadingAria")}>
          <div className="h-24 animate-pulse rounded-2xl bg-muted/50" />
          <div className="h-24 animate-pulse rounded-2xl bg-muted/50" />
        </div>
      ) : sessionStatus === "unauthenticated" || !accessToken ? (
        <BusinessEmptyState
          icon={Building2}
          title={t("orgsSignInTitle")}
          description={t("orgsSignInHint")}
        />
      ) : isPending ? (
        <div className="space-y-3" aria-busy aria-label={t("orgsLoadingAria")}>
          <div className="h-32 animate-pulse rounded-2xl bg-muted/50" />
          <div className="h-32 animate-pulse rounded-2xl bg-muted/50" />
        </div>
      ) : isError ? (
        <div
          className="rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-foreground"
          role="alert"
        >
          <p className="font-medium">{t("orgsLoadError")}</p>
          <button
            type="button"
            className={cn(
              motion.interactive,
              "mt-2 text-sm font-medium text-primary underline-offset-2 hover:underline",
            )}
            onClick={() => void refetch()}
          >
            {t("orgsRetry")}
          </button>
        </div>
      ) : showList ? (
        <ul
          className="flex flex-col gap-3"
          aria-label={t("orgListAria")}
          role="list"
        >
          {organizations.map((org) => {
            const isPendingMembership = org.membershipStatus === "pending_join";
            const draft = org.salonCabinetPreview;
            const displayName = displayNameForCabinetOrganization(org);
            const hasDraftUnderReview = draft != null;
            const showModerationPendingBadge =
              hasDraftUnderReview || org.publicationModerationStatus === "pending_review";
            const persistedCoverUrl =
              draft?.coverImageUrl != null ?
                draft.coverImageUrl
              : org.publishedCoverImageUrl != null ?
                org.publishedCoverImageUrl
              : null;
            const coverSrc =
              persistedCoverUrl != null ?
                previewSrcForPersistedGalleryUrl(persistedCoverUrl)
              : null;
            const canEditSalon =
              org.membershipStatus === "employed" &&
              canOrganization(org, OrganizationCapabilities.PROFILE_MANAGE);
            const statusBadges =
              isPendingMembership ||
              showModerationPendingBadge ||
              org.publicationModerationStatus === "rejected";
            const switchId = `org-current-workplace-${org.id}`;
            const deleteOrgInteractionBusy =
              deleteOrganizationMutation.isPending ||
              deleteOrganizationFlowBusyOrgId != null;
            const switchInteractionBusy =
              setActiveWorkplaceMutation.isPending ||
              previewSwitchAwayBusy ||
              deleteOrgInteractionBusy;
            const showOwnerDeleteOrg =
              org.membershipStatus === "employed" &&
              canOrganization(org, OrganizationCapabilities.DELETE);
            const showEditSalon = canEditSalon;
            const trailingOrgCardActions =
              (showOwnerDeleteOrg ? 1 : 0) + (showEditSalon ? 1 : 0);
            const organizationCabinetHref =
              org.membershipStatus === "employed" ?
                `/business/organizations/${org.id}`
              : `/organizations/${org.id}`;
            const organizationPrimaryAriaLabel =
              org.membershipStatus === "employed" ?
                t("orgOpenOrganizationCabinet")
              : t("orgOpenPublicProfile");

            return (
              <li
                key={
                  org.membershipStatus === "pending_join" &&
                  typeof org.workplaceJoinRequestId === "string" ?
                    `pending-join-${org.workplaceJoinRequestId}`
                  : org.id
                }
              >
                <article
                  className={cn(
                    "overflow-hidden rounded-2xl border bg-card shadow-sm ring-1 ring-border/30",
                    org.isActiveWorkplace ?
                      "border-primary"
                    : "border-border/60",
                  )}
                  aria-labelledby={`org-card-title-${org.id}`}
                >
                  <div className="relative p-4">
                    <div
                      className={cn(
                        trailingOrgCardActions >= 2 && "pr-24",
                        trailingOrgCardActions === 1 && "pr-11",
                      )}
                    >
                      <Link
                        href={organizationCabinetHref}
                        className={cn(
                          motion.interactivePress,
                          "block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        )}
                        aria-label={organizationPrimaryAriaLabel}
                      >
                      <div className="flex gap-3.5">
                        <div
                          className={cn(
                            "relative size-14 shrink-0 overflow-hidden rounded-xl",
                            coverSrc ?
                              "bg-muted"
                            : "flex items-center justify-center bg-muted/80 text-muted-foreground",
                          )}
                        >
                          {coverSrc ?
                            // eslint-disable-next-line @next/next/no-img-element -- URL из аплоада
                            <img
                              src={coverSrc}
                              alt=""
                              className="size-full object-cover"
                            />
                          : <Building2 className="size-6 opacity-55" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3
                            id={`org-card-title-${org.id}`}
                            className="font-heading text-base font-semibold leading-snug tracking-tight text-foreground"
                          >
                            {displayName}
                          </h3>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {isPendingMembership ?
                              t("orgMembershipPendingSubtitle")
                            : t(orgRoleLabelKey(org.role as string))}
                          </p>
                          {statusBadges ?
                            <ul
                              className="mt-3 flex list-none flex-wrap gap-1.5 p-0"
                              aria-label={t("orgCardStatusListAria")}
                            >
                              {isPendingMembership ?
                                <li>
                                  <span className="inline-flex rounded-full bg-sky-500/14 px-2.5 py-0.5 text-xs font-medium text-sky-950 dark:text-sky-100">
                                    {t("orgMembershipPendingBadge")}
                                  </span>
                                </li>
                              : null}
                              {showModerationPendingBadge ?
                                <li>
                                  <span className="inline-flex rounded-full bg-amber-500/14 px-2.5 py-0.5 text-xs font-medium text-amber-950 dark:text-amber-100">
                                    {t("orgPublicationPendingBadge")}
                                  </span>
                                </li>
                              : null}
                              {org.publicationModerationStatus === "rejected" ?
                                <li>
                                  <span className="inline-flex rounded-full bg-destructive/12 px-2.5 py-0.5 text-xs font-medium text-destructive">
                                    {t("orgPublicationRejectedBadge")}
                                  </span>
                                </li>
                              : null}
                            </ul>
                          : null}
                          {hasDraftUnderReview &&
                          org.publicationModerationStatus === "approved" ?
                            <p className="mt-3 border-l-2 border-amber-500/40 py-0.5 pl-3 text-pretty text-[0.8125rem] leading-relaxed text-muted-foreground">
                              {t("orgCabinetDraftPublicUsesPublishedHint")}
                            </p>
                          : null}
                        </div>
                      </div>
                    </Link>
                      {!isPendingMembership && org.membershipStatus === "employed" ?
                        <Link
                          href={`/organizations/${org.id}`}
                          className={cn(
                            motion.interactive,
                            "mt-2 block text-xs font-medium text-primary underline-offset-2 hover:underline",
                          )}
                        >
                          {t("orgOpenPublicProfile")}
                        </Link>
                      : null}
                    </div>
                    {trailingOrgCardActions > 0 ?
                      <div className="absolute right-2 top-2 z-[1] flex items-center gap-0.5">
                        {showEditSalon ?
                          <Button
                            variant="ghost"
                            size="icon-lg"
                            className="shrink-0 rounded-xl text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                            asChild
                          >
                            <Link
                              href={`/business/organizations/${org.id}/edit`}
                              aria-label={t("orgEditSalonAria")}
                            >
                              <Pencil className="size-[1.125rem]" aria-hidden />
                            </Link>
                          </Button>
                        : null}
                        {showOwnerDeleteOrg ?
                          <Button
                            variant="ghost"
                            size="icon-lg"
                            type="button"
                            disabled={deleteOrgInteractionBusy}
                            className="shrink-0 rounded-xl text-destructive hover:bg-destructive/15 hover:text-destructive disabled:text-destructive/40"
                            aria-label={t("orgDeleteSalonAria")}
                            onClick={() => void requestDeleteOrganization(org.id)}
                          >
                            <Trash2 className="size-[1.125rem]" aria-hidden />
                          </Button>
                        : null}
                      </div>
                    : null}
                  </div>

                  {(() => {
                    if (!canEditSalon) {
                      return null;
                    }
                    const managedIdx = managedOrgs.findIndex((o) => o.id === org.id);
                    if (managedIdx < 0) {
                      return null;
                    }
                    const incomingQ = incomingPerOrgQueries[managedIdx];
                    if (!incomingQ || incomingQ.isError) {
                      return null;
                    }
                    const pendingRequests =
                      incomingQ.data?.requests.filter((r) => r.status === "pending") ??
                      [];
                    const showIncomingSection =
                      incomingQ.isPending || pendingRequests.length > 0;
                    if (!showIncomingSection) {
                      return null;
                    }
                    return (
                      <>
                        <Separator className="bg-border/60" />
                        {incomingQ.isPending ?
                          <section
                            className="px-4 pb-2 pt-1.5"
                            aria-label={t("orgCardIncomingSectionAria")}
                          >
                            <div
                              className="flex items-center justify-between gap-2 py-0.5"
                              aria-busy
                              aria-label={t("organizationIncomingLoadingAria")}
                            >
                              <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                                {t("orgCardIncomingHeading")}
                              </p>
                              <Loader2
                                className="size-3.5 shrink-0 animate-spin text-muted-foreground"
                                aria-hidden
                              />
                            </div>
                          </section>
                        : <Collapsible defaultOpen={false}>
                            <section
                              className="px-4 pb-2 pt-1.5"
                              aria-label={t("orgCardIncomingSectionAria")}
                            >
                              <CollapsibleTrigger
                                type="button"
                                className={cn(
                                  motion.interactivePress,
                                  "flex w-full items-center justify-between gap-2 rounded-lg py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=open]:[&_svg]:rotate-180",
                                )}
                              >
                                <span className="min-w-0 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                                  {t("orgCardIncomingCollapsibleTrigger", {
                                    count: pendingRequests.length,
                                  })}
                                </span>
                                <ChevronDown
                                  className="size-4 shrink-0 text-muted-foreground transition-transform duration-200"
                                  aria-hidden
                                />
                              </CollapsibleTrigger>
                              <CollapsibleContent className="pt-1">
                                <ul
                                  className="max-h-36 list-none space-y-1 overflow-y-auto overscroll-contain p-0"
                                  aria-label={t("organizationIncomingListAria")}
                                >
                                  {pendingRequests.map((r) => {
                                    const rowBusy =
                                      reviewJoinRequestMutation.isPending &&
                                      reviewJoinRequestMutation.variables?.requestId === r.id;
                                    const received = format.dateTime(new Date(r.createdAt), {
                                      dateStyle: "short",
                                      timeStyle: "short",
                                    });
                                    return (
                                      <li
                                        key={r.id}
                                        className="rounded-lg border border-border/45 bg-muted/20 px-2 py-1.5"
                                      >
                                        <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
                                          <div className="min-w-0 flex-1">
                                            <p className="min-w-0 truncate text-[0.8125rem] font-medium leading-tight text-foreground">
                                              <span>{r.specialist.user.name}</span>
                                              <span className="font-normal text-muted-foreground">
                                                {" · "}
                                                {received}
                                              </span>
                                            </p>
                                            <p className="mt-px min-w-0 truncate text-[0.65rem] leading-tight text-muted-foreground">
                                              {r.specialist.user.email}
                                            </p>
                                          </div>
                                          <div className="flex shrink-0 items-center">
                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <Button
                                                  type="button"
                                                  variant="secondary"
                                                  tone="light"
                                                  size="icon"
                                                  className="size-8 shrink-0 rounded-md border border-border text-muted-foreground hover:text-foreground"
                                                  disabled={rowBusy || deleteOrgInteractionBusy}
                                                  aria-label={t(
                                                    "organizationIncomingRequestMenuAria",
                                                  )}
                                                >
                                                  <MoreVertical className="size-4" aria-hidden />
                                                </Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent align="end" className="min-w-[11rem]">
                                                <DropdownMenuItem asChild>
                                                  <Link
                                                    href={`/business/organizations/${org.id}/applicants/${r.specialistId}`}
                                                    className="cursor-pointer gap-2"
                                                  >
                                                    {t("organizationIncomingOpenProfile")}
                                                  </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                  disabled={rowBusy || deleteOrgInteractionBusy}
                                                  className="cursor-pointer gap-2"
                                                  onSelect={() =>
                                                    reviewJoinRequestMutation.mutate({
                                                      organizationId: org.id,
                                                      requestId: r.id,
                                                      decision: "accept",
                                                    })
                                                  }
                                                >
                                                  {t("incomingAccept")}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                  disabled={rowBusy || deleteOrgInteractionBusy}
                                                  className="cursor-pointer gap-2"
                                                  onSelect={() =>
                                                    reviewJoinRequestMutation.mutate({
                                                      organizationId: org.id,
                                                      requestId: r.id,
                                                      decision: "reject",
                                                    })
                                                  }
                                                >
                                                  {t("incomingReject")}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                  disabled={rowBusy || deleteOrgInteractionBusy}
                                                  className="cursor-pointer gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                                                  onSelect={() => {
                                                    if (
                                                      !window.confirm(t("incomingBlockConfirm"))
                                                    ) {
                                                      return;
                                                    }
                                                    reviewJoinRequestMutation.mutate({
                                                      organizationId: org.id,
                                                      requestId: r.id,
                                                      decision: "block",
                                                    });
                                                  }}
                                                >
                                                  {t("incomingBlock")}
                                                </DropdownMenuItem>
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                          </div>
                                        </div>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </CollapsibleContent>
                            </section>
                          </Collapsible>
                        }
                      </>
                    );
                  })()}

                  {!isPendingMembership ?
                    <div className="border-t border-border/60 px-3 py-2.5 sm:px-4">
                      <div className="flex min-h-9 items-center justify-between gap-2.5">
                      <label
                        htmlFor={switchId}
                        className="min-w-0 flex-1 text-xs font-medium leading-snug text-foreground"
                      >
                        {t("orgActiveWorkplaceBadge")}
                      </label>
                      <Switch
                        id={switchId}
                        size="default"
                        checked={org.isActiveWorkplace}
                        disabled={switchInteractionBusy}
                        aria-label={
                          org.isActiveWorkplace ?
                            t("orgActiveWorkplaceSwitchClearAria")
                          : t("orgSetActiveWorkplaceAria")
                        }
                        onCheckedChange={(on) => {
                          void (async () => {
                            if (switchInteractionBusy) {
                              return;
                            }
                            if (!on && org.isActiveWorkplace) {
                              setPreviewSwitchAwayBusy(true);
                              try {
                                const preview =
                                  await specialistsCabinetGetSpecialistActiveOrganizationBookingsPreview(
                                    {
                                      client: sdk,
                                      query: {
                                        organizationId: org.id,
                                        locale,
                                      },
                                    },
                                  );
                                if (preview.error || !preview.data) {
                                  notify.error(t("orgSwitchWorkplacePreviewLoadError"));
                                  return;
                                }
                                const rows = preview.data.bookings;
                                if (rows.length > 0) {
                                  const ok = await confirmAction({
                                    title: t("orgClearWorkplaceConfirmTitle"),
                                    body: (
                                      <OrgSwitchWorkplaceBookingsConfirmBody rows={rows} />
                                    ),
                                    confirmLabel: t("orgClearWorkplaceConfirmAction"),
                                    cancelLabel: t("orgClearWorkplaceConfirmBack"),
                                    destructive: true,
                                  });
                                  if (!ok) {
                                    return;
                                  }
                                }
                              } finally {
                                setPreviewSwitchAwayBusy(false);
                              }
                              try {
                                await setActiveWorkplaceMutation.mutateAsync(null);
                              } catch {
                                /* Mutation onError notifies */
                              }
                              return;
                            }

                            if (!on || org.isActiveWorkplace) {
                              return;
                            }

                            if (
                              activeWorkplaceId != null &&
                              activeWorkplaceId !== org.id
                            ) {
                              setPreviewSwitchAwayBusy(true);
                              try {
                                const preview =
                                  await specialistsCabinetGetSpecialistActiveOrganizationBookingsPreview(
                                    {
                                      client: sdk,
                                      query: {
                                        organizationId: activeWorkplaceId,
                                        locale,
                                      },
                                    },
                                  );
                                if (preview.error || !preview.data) {
                                  notify.error(t("orgSwitchWorkplacePreviewLoadError"));
                                  return;
                                }
                                const rows = preview.data.bookings;
                                if (rows.length > 0) {
                                  const ok = await confirmAction({
                                    title: t("orgSwitchWorkplaceCancelBookingsConfirmTitle"),
                                    body: (
                                      <OrgSwitchWorkplaceBookingsConfirmBody
                                        rows={rows}
                                      />
                                    ),
                                    confirmLabel: t("orgSwitchWorkplaceCancelBookingsConfirmAction"),
                                    cancelLabel: t("orgSwitchWorkplaceCancelBookingsConfirmBack"),
                                    destructive: true,
                                  });
                                  if (!ok) {
                                    return;
                                  }
                                }
                              } finally {
                                setPreviewSwitchAwayBusy(false);
                              }
                            }
                            try {
                              await setActiveWorkplaceMutation.mutateAsync(org.id);
                            } catch {
                              /* Mutation onError notifies */
                            }
                          })();
                        }}
                      />
                      </div>
                    </div>
                  : null}
                </article>
              </li>
            );
          })}
        </ul>
      ) : showEmpty ? (
        <BusinessEmptyState
          icon={Building2}
          title={t("emptyOrganizationsTitle")}
          description={t("emptyOrganizationsHint")}
        />
      ) : null}
    </main>
  );
}
