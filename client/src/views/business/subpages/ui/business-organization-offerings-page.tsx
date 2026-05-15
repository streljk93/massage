"use client";

import {
  Eye,
  Layers,
  Loader2,
  Package,
  Pencil,
  Plus,
  PowerOff,
  Trash2,
  UploadCloud,
  Users,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Link } from "@/app/i18n/navigation";
import type { AppLocale } from "@/app/i18n/routing";
import { BusinessEmptyState } from "@/entities/business";
import {
  OrganizationCapabilities,
  canOrganization,
  specialistMyOrganizationsQueryKey,
} from "@/entities/organizations";
import {
  createBrowserSdkClient,
  organizationOfferingsCabinetDeleteOffering,
  organizationOfferingsCabinetListMine,
  organizationOfferingsCabinetPublishOffering,
  organizationOfferingsCabinetUnpublishOffering,
  specialistsCabinetGetSpecialistMyOrganizations,
  type OrganizationOfferingsCabinetListMineResponse,
} from "@/shared/api";
import { cn, motion } from "@/shared/lib";
import { Button } from "@/shared/ui";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/shadcn/alert-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSetBusinessPageTitle } from "@/widgets/business/chrome";

const OFFERINGS_QK = ["organizationOfferingsCabinet"] as const;

type OfferingCabinetRow =
  OrganizationOfferingsCabinetListMineResponse["offerings"][number];

function statusConfig(status: string) {
  if (status === "published") {
    return {
      borderClass: "border-l-emerald-500/80",
      badgeBg: "bg-emerald-500/12 text-emerald-800 dark:text-emerald-300",
      dotClass: "bg-emerald-500",
    };
  }
  if (status === "hidden") {
    return {
      borderClass: "border-l-amber-500/80",
      badgeBg: "bg-amber-500/12 text-amber-800 dark:text-amber-300",
      dotClass: "bg-amber-500",
    };
  }
  return {
    borderClass: "border-l-border/40",
    badgeBg: "bg-muted text-muted-foreground",
    dotClass: "bg-muted-foreground/50",
  };
}

function statusLabel(
  status: string,
  t: ReturnType<typeof useTranslations<"businessOrganizationOfferingsPage">>,
) {
  if (status === "published") return t("statusPublished");
  if (status === "hidden") return t("statusHidden");
  return t("statusDraft");
}

function InitialAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[0.6rem] font-semibold leading-none text-primary">
      {initials || "?"}
    </span>
  );
}

function OfferingSpecialists({
  offering,
  t,
}: {
  offering: OfferingCabinetRow;
  t: ReturnType<typeof useTranslations<"businessOrganizationOfferingsPage">>;
}) {
  const activeAssignments = offering.specialistAssignments.filter(
    (a) => a.status === "active",
  );
  const items =
    activeAssignments.length > 0
      ? activeAssignments.map((a) => ({
          key: a.id,
          label: a.displayName ?? a.specialistId,
        }))
      : offering.eligibleSpecialists.map((s) => ({
          key: s.specialistId,
          label: s.displayName ?? s.specialistId,
        }));

  const isAssigned = activeAssignments.length > 0;

  return (
    <div className="border-t border-border/40 px-4 py-3">
      <div className="flex items-center gap-1.5">
        <Users className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="text-xs font-medium text-muted-foreground">
          {isAssigned ? t("assignmentsTitle") : t("eligibleSpecialistsTitle")}
        </span>
      </div>
      {items.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((s) => (
            <span
              key={s.key}
              className="flex items-center gap-1.5 rounded-full border border-border/50 bg-background pl-1 pr-2.5 py-0.5 text-xs"
            >
              <InitialAvatar name={s.label} />
              <span className="font-medium leading-none">{s.label}</span>
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {t("noEligibleSpecialists")}
        </p>
      )}
    </div>
  );
}

function OfferingCard({
  offering,
  organizationId,
  sdk,
  format,
  t,
  canManage,
}: {
  offering: OfferingCabinetRow;
  organizationId: string;
  sdk: ReturnType<typeof createBrowserSdkClient>;
  format: ReturnType<typeof useFormatter>;
  t: ReturnType<typeof useTranslations<"businessOrganizationOfferingsPage">>;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const invalidate = (): void => {
    void qc.invalidateQueries({ queryKey: OFFERINGS_QK });
  };

  const publishMut = useMutation({
    mutationFn: async () => {
      const { error } = await organizationOfferingsCabinetPublishOffering({
        client: sdk,
        path: { organizationId, offeringId: offering.id },
      });
      if (error) throw new Error("publish");
    },
    onSuccess: invalidate,
  });

  const unpublishMut = useMutation({
    mutationFn: async () => {
      const { error } = await organizationOfferingsCabinetUnpublishOffering({
        client: sdk,
        path: { organizationId, offeringId: offering.id },
      });
      if (error) throw new Error("unpublish");
    },
    onSuccess: invalidate,
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      const { error } = await organizationOfferingsCabinetDeleteOffering({
        client: sdk,
        path: { organizationId, offeringId: offering.id },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setDeleteOpen(false);
    },
  });

  const canPublishGate = offering.priceOptions.some(
    (o) => o.status === "active" && o.currency === "VND",
  );
  const { borderClass, badgeBg, dotClass } = statusConfig(offering.publicationStatus);
  const activePrices = offering.priceOptions.filter((o) => o.status === "active");
  const inactivePrices = offering.priceOptions.filter((o) => o.status !== "active");

  return (
    <li
      className={cn(
        "overflow-hidden rounded-2xl border border-l-4 border-border/60 bg-card text-card-foreground",
        borderClass,
      )}
    >
      {/* Card header */}
      <div className="p-4 pb-3">
        <div className="flex items-start gap-2.5">
          <div className="min-w-0 flex-1">
            <h3 className="font-heading text-sm font-semibold leading-snug">
              {offering.title}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {offering.category.majorCategory.name}
              {" · "}
              {offering.category.name}
            </p>
          </div>
          <span
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              badgeBg,
            )}
          >
            <span className={cn("size-1.5 rounded-full shrink-0", dotClass)} aria-hidden />
            {statusLabel(offering.publicationStatus, t)}
          </span>
        </div>

        {offering.description?.trim() ? (
          <p className="mt-2.5 line-clamp-2 text-pretty text-sm leading-snug text-muted-foreground">
            {offering.description}
          </p>
        ) : null}

        {offering.bodyZones.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {offering.bodyZones.map((zone) => (
              <span
                key={zone.id}
                className="rounded-full bg-muted/70 px-2 py-0.5 text-xs text-muted-foreground"
              >
                {zone.name}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Price options */}
      <div className="border-t border-border/40 px-4 py-3">
        {offering.priceOptions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {activePrices.map((po) => (
              <div
                key={po.id}
                className="flex items-center gap-1.5 rounded-xl border border-border/50 bg-muted/40 px-2.5 py-1.5 text-xs font-medium tabular-nums"
              >
                <span className="text-foreground">
                  {po.durationMinutes}{" "}
                  <span className="font-normal text-muted-foreground">
                    {t("minuteAbbr")}
                  </span>
                </span>
                <span className="text-border">·</span>
                <span className="text-foreground">
                  {po.currency === "VND"
                    ? format.number(po.priceAmount, {
                        style: "currency",
                        currency: "VND",
                        currencyDisplay: "narrowSymbol",
                      })
                    : format.number(po.priceAmount)}
                </span>
              </div>
            ))}
            {inactivePrices.map((po) => (
              <div
                key={po.id}
                className="flex items-center gap-1.5 rounded-xl border border-border/30 bg-muted/20 px-2.5 py-1.5 text-xs tabular-nums text-muted-foreground/60 line-through"
              >
                <span>{po.durationMinutes} {t("minuteAbbr")}</span>
                <span>·</span>
                <span>
                  {po.currency === "VND"
                    ? format.number(po.priceAmount, {
                        style: "currency",
                        currency: "VND",
                        currencyDisplay: "narrowSymbol",
                      })
                    : format.number(po.priceAmount)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("noPriceOptions")}</p>
        )}
      </div>

      {/* Specialists */}
      <OfferingSpecialists offering={offering} t={t} />

      {/* Action footer */}
      {canManage ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/40 bg-muted/[0.07] px-4 py-2.5">
          <Button
            asChild
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 rounded-xl px-2.5 text-xs"
          >
            <Link
              href={`/business/organizations/${organizationId}/offerings/${offering.id}`}
            >
              <Pencil className="size-3.5" aria-hidden />
              {t("edit")}
            </Link>
          </Button>

          {offering.publicationStatus === "published" ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 rounded-xl px-2.5 text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-400"
              disabled={unpublishMut.isPending}
              onClick={() => void unpublishMut.mutate()}
            >
              {unpublishMut.isPending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <PowerOff className="size-3.5" aria-hidden />
              )}
              {t("unpublish")}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 rounded-xl px-2.5 text-xs text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-400 disabled:opacity-50"
              disabled={publishMut.isPending || !canPublishGate}
              onClick={() => void publishMut.mutate()}
            >
              {publishMut.isPending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <UploadCloud className="size-3.5" aria-hidden />
              )}
              {t("publish")}
            </Button>
          )}

          {!canPublishGate && offering.publicationStatus !== "published" ? (
            <span className="text-xs text-muted-foreground">
              {t("publishBlockedHint")}
            </span>
          ) : null}

          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 rounded-xl px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-3.5" aria-hidden />
            {t("deleteService")}
          </Button>
        </div>
      ) : null}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteServiceConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription className="text-pretty">
              {t("deleteServiceConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              tone="muted"
              className="rounded-xl"
              onClick={() => setDeleteOpen(false)}
            >
              {t("deleteServiceCancel")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="rounded-xl border border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={deleteMut.isPending}
              onClick={() => void deleteMut.mutate()}
            >
              {deleteMut.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="size-4" aria-hidden />
              )}
              {t("deleteServiceConfirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

function OfferingsLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-l-4 border-border/60 border-l-border/30 bg-card"
        >
          <div className="p-4 pb-3">
            <div className="flex items-start gap-2.5">
              <div className="flex-1 space-y-1.5">
                <div
                  className="h-4 animate-pulse rounded-md bg-muted/60"
                  style={{ width: `${55 + i * 15}%` }}
                />
                <div className="h-3 w-1/3 animate-pulse rounded-md bg-muted/40" />
              </div>
              <div className="h-6 w-20 animate-pulse rounded-full bg-muted/50" />
            </div>
          </div>
          <div className="border-t border-border/40 px-4 py-3">
            <div className="flex gap-2">
              {[0, 1].map((j) => (
                <div
                  key={j}
                  className="h-7 w-24 animate-pulse rounded-xl bg-muted/50"
                />
              ))}
            </div>
          </div>
          <div className="border-t border-border/40 px-4 py-3">
            <div className="flex gap-1.5">
              {[0, 1].map((j) => (
                <div
                  key={j}
                  className="h-6 w-20 animate-pulse rounded-full bg-muted/40"
                />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function BusinessOrganizationOfferingsPage() {
  const t = useTranslations("businessOrganizationOfferingsPage");
  useSetBusinessPageTitle(t("pageTitle"));
  const tPage = useTranslations("businessAppSubpages");
  const format = useFormatter();
  const locale = useLocale() as AppLocale;
  const params = useParams<{ organizationId: string }>();
  const organizationId = params.organizationId ?? "";

  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken ?? "";

  const sdk = useMemo(
    () => createBrowserSdkClient(accessToken, { locale }),
    [accessToken, locale],
  );

  const authed = sessionStatus === "authenticated" && accessToken.length > 0;

  const membershipsQuery = useQuery({
    queryKey: specialistMyOrganizationsQueryKey(accessToken, locale),
    enabled: authed,
    queryFn: async () => {
      const { data: res, error: err } =
        await specialistsCabinetGetSpecialistMyOrganizations({ client: sdk });
      if (err || !res) {
        throw err ?? new Error("organizations");
      }
      return res;
    },
  });

  const membership = useMemo(
    () =>
      membershipsQuery.data?.organizations.find((o) => o.id === organizationId),
    [membershipsQuery.data?.organizations, organizationId],
  );

  const employed =
    membership != null &&
    membership.membershipStatus === "employed" &&
    organizationId !== "";
  const canView =
    employed &&
    canOrganization(membership, OrganizationCapabilities.OFFERINGS_VIEW);
  const canManage =
    employed &&
    canOrganization(membership, OrganizationCapabilities.OFFERINGS_MANAGE);

  const offeringsQuery = useQuery({
    queryKey: [...OFFERINGS_QK, organizationId, accessToken, locale] as const,
    enabled: authed && canView && membershipsQuery.isSuccess,
    queryFn: async () => {
      const { data: res, error: err } = await organizationOfferingsCabinetListMine({
        client: sdk,
        path: { organizationId },
        query: { locale },
      });
      if (err || !res) {
        throw err ?? new Error("offerings");
      }
      return res;
    },
  });

  const orgTitle =
    membership?.salonCabinetPreview?.name?.trim() || membership?.name || "";

  if (sessionStatus === "loading" || membershipsQuery.isPending) {
    return (
      <main className="flex w-full min-h-0 flex-1 flex-col gap-5 px-4 pt-2">
        <OfferingsLoadingSkeleton />
      </main>
    );
  }

  if (sessionStatus === "unauthenticated" || !accessToken) {
    return (
      <main className="flex w-full min-h-0 flex-1 flex-col gap-5 px-4 pt-2">
        <BusinessEmptyState
          icon={Package}
          title={t("signInTitle")}
          description={t("signInHint")}
        />
      </main>
    );
  }

  if (membershipsQuery.isError || !membership || organizationId === "") {
    return (
      <main className="flex w-full min-h-0 flex-1 flex-col gap-5 px-4 pt-2">
        <BusinessEmptyState
          icon={Package}
          title={tPage("organizationEditNotFoundTitle")}
          description={t("notFoundHint")}
        />
      </main>
    );
  }

  if (!canView) {
    return (
      <main className="flex w-full min-h-0 flex-1 flex-col gap-5 px-4 pt-2">
        <BusinessEmptyState
          icon={Package}
          title={orgTitle}
          description={t("forbiddenHint")}
        />
      </main>
    );
  }

  if (offeringsQuery.isError) {
    return (
      <main className="flex w-full min-h-0 flex-1 flex-col gap-5 px-4 pt-2">
        <BusinessEmptyState
          icon={Package}
          title={t("loadErrorTitle")}
          description={tPage("organizationEditLoadErrorHint")}
        />
        <Button
          type="button"
          variant="ghost"
          className="rounded-xl"
          onClick={() => void offeringsQuery.refetch()}
        >
          {t("loadErrorRetry")}
        </Button>
      </main>
    );
  }

  const offerings = offeringsQuery.data?.offerings ?? [];
  const publishedCount = offerings.filter(
    (o) => o.publicationStatus === "published",
  ).length;

  return (
    <main className="flex w-full min-h-0 flex-1 flex-col gap-5 px-4 pt-2">
      {(offeringsQuery.isSuccess && offerings.length > 0) || canManage ? (
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {offeringsQuery.isSuccess && offerings.length > 0 ? (
              <>
                <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card px-3 py-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/15">
                    <Eye className="size-3 text-emerald-700 dark:text-emerald-400" aria-hidden />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    <span className="font-semibold tabular-nums text-foreground">
                      {publishedCount}
                    </span>
                    {" "}
                    {t("statsPublished")}
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card px-3 py-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-muted">
                    <Layers className="size-3 text-muted-foreground" aria-hidden />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    <span className="font-semibold tabular-nums text-foreground">
                      {offerings.length - publishedCount}
                    </span>
                    {" "}
                    {t("statsDraftsHidden")}
                  </span>
                </div>
              </>
            ) : null}
          </div>
          {canManage ? (
            <Button asChild className={cn(motion.interactivePress, "shrink-0 rounded-xl")}>
              <Link
                href={`/business/organizations/${organizationId}/offerings/new`}
              >
                <Plus className="size-4" aria-hidden />
                {t("createService")}
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Offerings list */}
      {offeringsQuery.isPending ? (
        <OfferingsLoadingSkeleton />
      ) : offerings.length === 0 ? (
        <BusinessEmptyState
          icon={Package}
          title={t("emptyTitle")}
          description={t("emptyHint")}
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {offerings.map((row) => (
            <OfferingCard
              key={row.id}
              offering={row}
              organizationId={organizationId}
              sdk={sdk}
              format={format}
              t={t}
              canManage={canManage}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
