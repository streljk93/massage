"use client";

import { Building2, Pencil, Trash2 } from "lucide-react";
import { parseISO } from "date-fns";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Link } from "@/app/i18n/navigation";
import type { AppLocale } from "@/app/i18n/routing";
import { BusinessEmptyState } from "@/entities/business";
import {
  displayNameForCabinetOrganization,
  specialistMyOrganizationsQueryKey,
  SPECIALIST_MY_ORGANIZATIONS_QUERY_KEY_PREFIX,
} from "@/entities/organizations";
import {
  createBrowserSdkClient,
  organizationsCabinetDeleteOrganizationAsOwner,
  organizationsCabinetGetDeleteOrganizationBookingsPreview,
  specialistsCabinetGetSpecialistActiveOrganizationBookingsPreview,
  specialistsCabinetGetSpecialistMyOrganizations,
  specialistsCabinetPatchSpecialistActiveOrganization,
  type OrganizationsCabinetGetDeleteOrganizationBookingsPreviewResponse,
  type SpecialistsCabinetGetSpecialistActiveOrganizationBookingsPreviewResponse,
} from "@/shared/api";
import { confirmAction, notify } from "@/shared/lib/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BusinessScreenHeader } from "@/widgets/business/chrome";
import { Button } from "@/shared/ui/button";
import { Switch } from "@/shared/ui/switch";
import { cn, motion, previewSrcForPersistedGalleryUrl } from "@/shared/lib";

const ONB_QK = ["specialistOnboarding"] as const;

function roleAllowsSalonCabinetEditing(role: string): boolean {
  return role === "owner" || role === "admin";
}

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
    <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
      <BusinessScreenHeader
        title={t("organizationsTitle")}
        titleVariant="section"
        showHeadline={false}
        avatarAlt={t("organizationsTitle")}
        avatarFallback="B"
        actions={
          sessionStatus === "authenticated" && accessToken.length > 0 ?
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
          : undefined
        }
      />

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
            const draft = org.salonCabinetPreview;
            const displayName = displayNameForCabinetOrganization(org);
            const hasDraftUnderReview = draft != null;
            const showModerationPendingBadge =
              hasDraftUnderReview ||
              org.publicationModerationStatus === "pending_review";
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
            const canEditSalon = roleAllowsSalonCabinetEditing(org.role);
            const statusBadges =
              showModerationPendingBadge || org.publicationModerationStatus === "rejected";
            const switchId = `org-current-workplace-${org.id}`;
            const deleteOrgInteractionBusy =
              deleteOrganizationMutation.isPending ||
              deleteOrganizationFlowBusyOrgId != null;
            const switchInteractionBusy =
              setActiveWorkplaceMutation.isPending ||
              previewSwitchAwayBusy ||
              deleteOrgInteractionBusy;
            const showOwnerDeleteOrg = org.role === "owner";
            const showEditSalon = canEditSalon;
            const trailingOrgCardActions =
              (showOwnerDeleteOrg ? 1 : 0) + (showEditSalon ? 1 : 0);

            return (
              <li key={org.id}>
                <article
                  className={cn(
                    "overflow-hidden rounded-2xl border bg-card",
                    org.isActiveWorkplace ?
                      "border-primary"
                    : "border-border/60",
                  )}
                  aria-labelledby={`org-card-title-${org.id}`}
                >
                  <div className="relative p-4">
                    <Link
                      href={`/organizations/${org.id}`}
                      className={cn(
                        motion.interactivePress,
                        "block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        trailingOrgCardActions >= 2 && "pr-24",
                        trailingOrgCardActions === 1 && "pr-11",
                      )}
                      aria-label={t("orgOpenPublicProfile")}
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
                            {t(orgRoleLabelKey(org.role))}
                          </p>
                          {statusBadges ?
                            <ul
                              className="mt-3 flex list-none flex-wrap gap-1.5 p-0"
                              aria-label={t("orgCardStatusListAria")}
                            >
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
