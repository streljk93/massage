"use client";

import { Loader2, Package, Trash2, UserMinus } from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/app/i18n/routing";
import { BusinessEmptyState } from "@/entities/business";
import { specialistMyOrganizationsQueryKey } from "@/entities/organizations";
import {
  catalogGetBulkCategoriesByMajorSlugs,
  createBrowserSdkClient,
  organizationOfferingsCabinetCreateDraft,
  organizationOfferingsCabinetCreatePriceOption,
  organizationOfferingsCabinetCreateSpecialistAssignment,
  organizationOfferingsCabinetListAssignableSpecialists,
  organizationOfferingsCabinetListMine,
  organizationOfferingsCabinetPatchPriceOption,
  organizationOfferingsCabinetPatchSpecialistAssignment,
  organizationOfferingsCabinetPublishOffering,
  organizationsCabinetGetCabinetOrganizationProfileForEdit,
  specialistsCabinetGetSpecialistMyOrganizations,
  type OrganizationOfferingsCabinetListAssignableSpecialistsResponse,
  type OrganizationOfferingsCabinetListMineResponse,
} from "@/shared/api";
import { cn } from "@/shared/lib";
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
import { BusinessScreenHeader } from "@/widgets/business/chrome";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const CABINET_EDIT_QK = ["organizationCabinetEditProfile"] as const;
const OFFERINGS_QK = ["organizationOfferingsCabinet"] as const;
const ASSIGNABLE_QK = ["organizationOfferingsAssignableSpecialists"] as const;

function roleAllowsSalonCabinetEditing(role: string): boolean {
  return role === "owner" || role === "admin";
}

type OfferingCabinetRow =
  OrganizationOfferingsCabinetListMineResponse["offerings"][number];

type AssignableRow =
  OrganizationOfferingsCabinetListAssignableSpecialistsResponse["specialists"][number];

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugifyAsciiTitle(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function OrganizationOfferingCabinetCard({
  offering,
  organizationId,
  sdk,
  format,
  t,
  categoryLabel,
  assignable,
}: {
  offering: OfferingCabinetRow;
  organizationId: string;
  sdk: ReturnType<typeof createBrowserSdkClient>;
  format: ReturnType<typeof useFormatter>;
  t: ReturnType<typeof useTranslations<"businessOrganizationOfferingsPage">>;
  categoryLabel: string;
  assignable: AssignableRow[];
}) {
  const qc = useQueryClient();
  const [durationStr, setDurationStr] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [pickSpecialistId, setPickSpecialistId] = useState("");

  const invalidateOfferingsBundle = (): void => {
    void qc.invalidateQueries({ queryKey: OFFERINGS_QK });
    void qc.invalidateQueries({ queryKey: ASSIGNABLE_QK });
  };

  const publishMut = useMutation({
    mutationFn: async () => {
      const { error } = await organizationOfferingsCabinetPublishOffering({
        client: sdk,
        path: { organizationId, offeringId: offering.id },
      });
      if (error) throw new Error("publish");
    },
    onSuccess: invalidateOfferingsBundle,
  });

  const addOptionMut = useMutation({
    mutationFn: async (body: { durationMinutes: number; priceAmount: number }) => {
      const { error } = await organizationOfferingsCabinetCreatePriceOption({
        client: sdk,
        path: { organizationId, offeringId: offering.id },
        body: {
          durationMinutes: body.durationMinutes,
          priceAmount: body.priceAmount,
          currency: "VND",
        },
      });
      if (error) throw new Error("option");
    },
    onSuccess: () => {
      setDurationStr("");
      setPriceStr("");
      invalidateOfferingsBundle();
    },
  });

  const removeOptionMut = useMutation({
    mutationFn: async (optionId: string) => {
      const { error } = await organizationOfferingsCabinetPatchPriceOption({
        client: sdk,
        path: {
          organizationId,
          offeringId: offering.id,
          optionId,
        },
        body: { remove: true },
      });
      if (error) throw new Error("rm-option");
    },
    onSuccess: invalidateOfferingsBundle,
  });

  const assignMut = useMutation({
    mutationFn: async (specialistId: string) => {
      const { error } =
        await organizationOfferingsCabinetCreateSpecialistAssignment({
          client: sdk,
          path: { organizationId, offeringId: offering.id },
          body: { specialistId },
        });
      if (error) throw new Error("assign");
    },
    onSuccess: () => {
      setPickSpecialistId("");
      invalidateOfferingsBundle();
    },
  });

  const removeAssignmentMut = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } =
        await organizationOfferingsCabinetPatchSpecialistAssignment({
          client: sdk,
          path: {
            organizationId,
            offeringId: offering.id,
            assignmentId,
          },
          body: { status: "removed" },
        });
      if (error) throw new Error("rm-assign");
    },
    onSuccess: invalidateOfferingsBundle,
  });

  const isPublishedEver = Boolean(offering.firstPublishedAt);
  const canPublishGate = offering.priceOptions.some(
    (o) => o.status === "active" && o.currency === "VND",
  );
  const assignedIds = new Set(
    offering.specialistAssignments.map((a) => a.specialistId),
  );
  const pickable = assignable.filter((a) => !assignedIds.has(a.specialistId));

  const addOptionSubmit = (): void => {
    const dm = Number.parseInt(durationStr.trim(), 10);
    const pr = Number.parseInt(priceStr.trim(), 10);
    if (
      Number.isNaN(dm) ||
      dm <= 0 ||
      Number.isNaN(pr) ||
      pr < 0 ||
      addOptionMut.isPending
    ) {
      return;
    }
    addOptionMut.mutate({ durationMinutes: dm, priceAmount: pr });
  };

  return (
    <li className="rounded-2xl border border-border/60 bg-card p-4 text-card-foreground">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-heading text-sm font-semibold leading-snug">
            {offering.title}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {categoryLabel} · {offering.slug}
          </p>
          {offering.description?.trim() ?
            <p className="mt-2 text-pretty text-sm leading-snug text-muted-foreground">
              {offering.description}
            </p>
          : null}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
            offering.publicationStatus === "published" ?
              "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
            : "bg-muted text-muted-foreground",
          )}
        >
          {offering.publicationStatus === "published" ?
            t("statusPublished")
          : t("statusDraft")}
        </span>
      </div>

      {isPublishedEver ?
        <p className="mt-2 text-xs text-muted-foreground">
          {t("editSlugLockedHint")}
        </p>
      : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="rounded-xl"
          disabled={
            publishMut.isPending ||
            !canPublishGate ||
            offering.publicationStatus === "published"
          }
          onClick={() => void publishMut.mutate()}
        >
          {publishMut.isPending ?
            <Loader2 className="size-4 animate-spin" aria-hidden />
          : t("publish")}
        </Button>
        {!canPublishGate ?
          <span className="self-center text-xs text-muted-foreground">
            {t("publishBlockedHint")}
          </span>
        : null}
      </div>

      <div className="mt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("addOptionTitle")}
        </h4>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex min-w-[7rem] flex-1 flex-col gap-1">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor={`dur-${offering.id}`}
            >
              {t("durationLabel")}
            </label>
            <Input
              id={`dur-${offering.id}`}
              inputMode="numeric"
              value={durationStr}
              onChange={(e) => setDurationStr(e.target.value)}
              className="rounded-xl"
              aria-label={t("durationLabel")}
            />
          </div>
          <div className="flex min-w-[7rem] flex-1 flex-col gap-1">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor={`price-${offering.id}`}
            >
              {t("priceLabel")}
            </label>
            <Input
              id={`price-${offering.id}`}
              inputMode="numeric"
              value={priceStr}
              onChange={(e) => setPriceStr(e.target.value)}
              className="rounded-xl"
              aria-label={t("priceLabel")}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="rounded-xl"
            disabled={addOptionMut.isPending}
            onClick={addOptionSubmit}
          >
            {t("addOption")}
          </Button>
        </div>
      </div>

      <ul className="mt-3 space-y-1">
        {offering.priceOptions.map((po) => (
          <li
            key={po.id}
            className="flex items-center justify-between gap-2 text-sm tabular-nums"
          >
            <span>
              {t("optionMinutes", {
                minutes: po.durationMinutes,
                price:
                  po.currency === "VND" ?
                    format.number(po.priceAmount, {
                      style: "currency",
                      currency: "VND",
                      currencyDisplay: "narrowSymbol",
                    })
                  : format.number(po.priceAmount),
              })}
              {" "}
              <span className="text-xs text-muted-foreground">
                (
                {po.status === "active" ?
                  t("optionStatusActive")
                : t("optionStatusOther", { status: po.status })}
                )
              </span>
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-9 shrink-0 rounded-xl text-muted-foreground hover:text-destructive"
              disabled={removeOptionMut.isPending}
              aria-label={t("removeOptionAria")}
              onClick={() => void removeOptionMut.mutate(po.id)}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </li>
        ))}
      </ul>

      <div className="mt-4 border-t border-border/50 pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("assignmentsTitle")}
        </h4>
        <ul className="mt-2 space-y-2">
          {offering.specialistAssignments.map((a) => (
            <li
              key={a.id}
              className="flex items-start justify-between gap-2 rounded-xl bg-muted/30 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <span className="font-medium">{a.displayName ?? a.specialistId}</span>
                <p className="text-xs text-muted-foreground">
                  {t("assignmentStatus", { status: a.status })}
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-9 shrink-0 rounded-xl text-muted-foreground hover:text-destructive"
                disabled={removeAssignmentMut.isPending}
                aria-label={t("removeAssignmentAria")}
                onClick={() => void removeAssignmentMut.mutate(a.id)}
              >
                <UserMinus className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={pickSpecialistId}
            onValueChange={(v) => setPickSpecialistId(v)}
            disabled={pickable.length === 0 || assignMut.isPending}
          >
            <SelectTrigger className="w-full rounded-xl sm:w-[min(22rem,calc(100%-4rem))]">
              <SelectValue placeholder={t("addSpecialistPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {pickable.map((s) => (
                <SelectItem key={s.specialistId} value={s.specialistId}>
                  {s.displayName ?? s.specialistId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            className="rounded-xl"
            disabled={
              assignMut.isPending ||
              pickSpecialistId.trim().length === 0 ||
              pickable.length === 0
            }
            onClick={() => assignMut.mutate(pickSpecialistId.trim())}
          >
            {t("assign")}
          </Button>
        </div>
        {pickable.length === 0 && assignable.length > 0 ?
          <p className="mt-2 text-xs text-muted-foreground">
            {t("assignDisabledHint")}
          </p>
        : null}
      </div>
    </li>
  );
}

export function BusinessOrganizationOfferingsPage() {
  const t = useTranslations("businessOrganizationOfferingsPage");
  const tPage = useTranslations("businessAppSubpages");
  const format = useFormatter();
  const locale = useLocale() as AppLocale;
  const params = useParams<{ organizationId: string }>();
  const organizationId = params.organizationId ?? "";

  const queryClient = useQueryClient();
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
      const { data: res, error: err } = await specialistsCabinetGetSpecialistMyOrganizations({
        client: sdk,
      });
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

  const canManage =
    membership != null &&
    membership.membershipStatus === "employed" &&
    roleAllowsSalonCabinetEditing(membership.role as string);

  const cabinetProfileQuery = useQuery({
    queryKey: [...CABINET_EDIT_QK, organizationId, accessToken, locale] as const,
    enabled:
      authed &&
      typeof organizationId === "string" &&
      organizationId.length > 0 &&
      canManage &&
      membershipsQuery.isSuccess,
    queryFn: async () => {
      const { data: res, error: err } =
        await organizationsCabinetGetCabinetOrganizationProfileForEdit({
          client: sdk,
          path: { organizationId },
          query: { locale },
        });
      if (err || !res) {
        throw err ?? new Error("cabinet-profile");
      }
      return res;
    },
  });

  const majorSlugsCsv = useMemo(
    () =>
      cabinetProfileQuery.data?.majorCategorySlugs
        ?.filter((s) => s.trim().length > 0)
        .join(",")
        ?.trim() ?? "",
    [cabinetProfileQuery.data?.majorCategorySlugs],
  );

  const catalogQuery = useQuery({
    queryKey: ["catalogBulkCategories", majorSlugsCsv, locale] as const,
    enabled: authed && majorSlugsCsv.length > 0 && canManage,
    queryFn: async () => {
      const { data, error } = await catalogGetBulkCategoriesByMajorSlugs({
        client: sdk,
        query: {
          majorSlugs: majorSlugsCsv,
          locale,
        },
      });
      if (error || !data) {
        throw error ?? new Error("catalog");
      }
      return data;
    },
  });

  const categoryLabelById = useMemo(() => {
    const m = new Map<string, string>();
    const sections = catalogQuery.data?.sections ?? [];
    for (const sec of sections) {
      const majorLabel = sec.majorCategory.name;
      for (const c of sec.categories) {
        m.set(c.id, `${majorLabel} — ${c.name}`);
      }
    }
    return m;
  }, [catalogQuery.data?.sections]);

  const offeringsQuery = useQuery({
    queryKey: [...OFFERINGS_QK, organizationId, accessToken, locale] as const,
    enabled: authed && canManage && membershipsQuery.isSuccess,
    queryFn: async () => {
      const { data: res, error: err } = await organizationOfferingsCabinetListMine({
        client: sdk,
        path: { organizationId },
      });
      if (err || !res) {
        throw err ?? new Error("offerings");
      }
      return res;
    },
  });

  const assignableQuery = useQuery({
    queryKey: [...ASSIGNABLE_QK, organizationId, accessToken, locale] as const,
    enabled: authed && canManage && membershipsQuery.isSuccess,
    queryFn: async () => {
      const { data: res, error: err } =
        await organizationOfferingsCabinetListAssignableSpecialists({
          client: sdk,
          path: { organizationId },
        });
      if (err || !res) {
        throw err ?? new Error("assignable");
      }
      return res;
    },
  });

  const [draftTitle, setDraftTitle] = useState("");
  const [draftSlug, setDraftSlug] = useState("");
  const [draftCategoryId, setDraftCategoryId] = useState("");
  const [draftDescription, setDraftDescription] = useState("");

  const createDraftMut = useMutation({
    mutationFn: async () => {
      const slug = draftSlug.trim().toLowerCase();
      if (!SLUG_RE.test(slug)) {
        throw new Error("slug");
      }
      const { error } = await organizationOfferingsCabinetCreateDraft({
        client: sdk,
        path: { organizationId },
        body: {
          title: draftTitle.trim(),
          slug,
          categoryId: draftCategoryId.trim(),
          description: draftDescription.trim() || null,
        },
      });
      if (error) throw new Error("draft");
    },
    onSuccess: () => {
      setDraftTitle("");
      setDraftSlug("");
      setDraftCategoryId("");
      setDraftDescription("");
      void queryClient.invalidateQueries({ queryKey: OFFERINGS_QK });
    },
  });

  const backToEdit = {
    href: `/business/organizations/${organizationId}/edit`,
    ariaLabel: t("backAria"),
  } as const;

  const flatCategories = useMemo(() => {
    const sections = catalogQuery.data?.sections ?? [];
    const rows: { id: string; label: string }[] = [];
    for (const sec of sections) {
      for (const c of sec.categories) {
        rows.push({
          id: c.id,
          label: `${sec.majorCategory.name} — ${c.name}`,
        });
      }
    }
    return rows;
  }, [catalogQuery.data?.sections]);

  const membershipDraftName = membership?.salonCabinetPreview?.name?.trim();
  const orgTitle =
    membershipDraftName != null && membershipDraftName.length > 0 ?
      membershipDraftName
    : (membership?.name ?? "");

  if (
    sessionStatus === "loading" ||
    membershipsQuery.isPending ||
    (canManage && cabinetProfileQuery.isPending)
  ) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
        <BusinessScreenHeader
          title={t("pageTitle")}
          titleVariant="section"
          showHeadline={false}
          avatarAlt={t("pageTitle")}
          avatarFallback="P"
          cabinetBack={
            organizationId ?
              backToEdit
            : {
                href: "/business/organizations",
                ariaLabel: tPage("organizationEditBackAria"),
              }
          }
        />
        <div
          className="h-40 animate-pulse rounded-2xl bg-muted/50"
          aria-busy
          aria-label={t("loadingAria")}
        />
      </main>
    );
  }

  if (sessionStatus === "unauthenticated" || !accessToken) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
        <BusinessScreenHeader
          title={t("pageTitle")}
          titleVariant="section"
          showHeadline={false}
          avatarAlt={t("pageTitle")}
          avatarFallback="P"
          cabinetBack={
            organizationId ?
              backToEdit
            : {
                href: "/business/organizations",
                ariaLabel: tPage("organizationEditBackAria"),
              }
          }
        />
        <BusinessEmptyState
          icon={Package}
          title={t("signInTitle")}
          description={t("signInHint")}
        />
      </main>
    );
  }

  if (
    membershipsQuery.isError ||
    !membership ||
    organizationId === ""
  ) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
        <BusinessScreenHeader
          title={t("pageTitle")}
          titleVariant="section"
          showHeadline={false}
          avatarAlt={t("pageTitle")}
          avatarFallback="P"
          cabinetBack={{
            href: "/business/organizations",
            ariaLabel: tPage("organizationEditBackAria"),
          }}
        />
        <BusinessEmptyState
          icon={Package}
          title={tPage("organizationEditNotFoundTitle")}
          description={t("notFoundHint")}
        />
      </main>
    );
  }

  if (!canManage) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
        <BusinessScreenHeader
          title={t("pageTitle")}
          titleVariant="section"
          showHeadline={false}
          avatarAlt={t("pageTitle")}
          avatarFallback="P"
          cabinetBack={backToEdit}
        />
        <BusinessEmptyState
          icon={Package}
          title={orgTitle}
          description={t("forbiddenHint")}
        />
      </main>
    );
  }

  if (cabinetProfileQuery.isError) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
        <BusinessScreenHeader
          title={t("pageTitle")}
          titleVariant="section"
          showHeadline={false}
          avatarAlt={t("pageTitle")}
          avatarFallback="P"
          cabinetBack={backToEdit}
        />
        <BusinessEmptyState
          icon={Package}
          title={tPage("organizationEditLoadErrorTitle")}
          description={tPage("organizationEditLoadErrorHint")}
        />
        <Button
          type="button"
          variant="ghost"
          className="rounded-xl"
          onClick={() => void cabinetProfileQuery.refetch()}
        >
          {t("loadErrorRetry")}
        </Button>
      </main>
    );
  }

  if (offeringsQuery.isError) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
        <BusinessScreenHeader
          title={orgTitle !== "" ? orgTitle : t("pageTitle")}
          titleVariant="section"
          showHeadline={false}
          avatarAlt={t("pageTitle")}
          avatarFallback="P"
          cabinetBack={backToEdit}
        />
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
  const assignable = assignableQuery.data?.specialists ?? [];
  const majorsMissing = majorSlugsCsv.length === 0;
  const catalogLoading = majorSlugsCsv.length > 0 && catalogQuery.isPending;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-8">
      <BusinessScreenHeader
        title={orgTitle !== "" ? orgTitle : t("pageTitle")}
        titleVariant="section"
        showHeadline={false}
        avatarAlt={t("pageTitle")}
        avatarFallback="P"
        cabinetBack={backToEdit}
      />

      {majorsMissing ?
        <section
          className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm"
          aria-live="polite"
        >
          <h2 className="font-heading text-sm font-semibold text-amber-950 dark:text-amber-100">
            {t("majorsMissingTitle")}
          </h2>
          <p className="mt-1 text-pretty text-xs leading-snug text-amber-950/80 dark:text-amber-100/90">
            {t("majorsMissingHint")}
          </p>
        </section>
      : null}

      <section className="rounded-2xl border border-border/60 bg-card p-4">
        <h2 className="font-heading text-sm font-semibold">{t("draftSectionTitle")}</h2>
        {catalogLoading ?
          <div
            className="mt-3 h-28 animate-pulse rounded-xl bg-muted/50"
            aria-busy
          />
        : (
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="draft-title">
                {t("fieldTitle")}
              </label>
              <Input
                id="draft-title"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onBlur={() => {
                  if (draftSlug.trim().length === 0 && draftTitle.trim().length > 0) {
                    const s = slugifyAsciiTitle(draftTitle);
                    if (s.length > 0) {
                      setDraftSlug(s);
                    }
                  }
                }}
                className="rounded-xl"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="draft-slug">
                {t("fieldSlug")}
              </label>
              <Input
                id="draft-slug"
                value={draftSlug}
                onChange={(e) => setDraftSlug(e.target.value.toLowerCase())}
                className="rounded-xl"
                disabled={majorsMissing}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                {t("fieldCategory")}
              </span>
              <Select
                value={draftCategoryId}
                onValueChange={setDraftCategoryId}
                disabled={majorsMissing || flatCategories.length === 0}
              >
                <SelectTrigger className="rounded-xl" id="draft-category">
                  <SelectValue placeholder={t("fieldCategoryPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {flatCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="draft-desc">
                {t("fieldDescription")}
              </label>
              <Textarea
                id="draft-desc"
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                className="min-h-[4.5rem] rounded-xl"
              />
            </div>
            <Button
              type="button"
              className="rounded-xl"
              disabled={
                createDraftMut.isPending ||
                majorsMissing ||
                catalogLoading ||
                draftTitle.trim().length === 0 ||
                !SLUG_RE.test(draftSlug.trim().toLowerCase()) ||
                draftCategoryId.trim().length === 0
              }
              onClick={() => void createDraftMut.mutate()}
            >
              {createDraftMut.isPending ?
                <Loader2 className="size-4 animate-spin" aria-hidden />
              : t("createDraft")}
            </Button>
          </div>
        )}
      </section>

      {offerings.length === 0 ?
        <BusinessEmptyState
          icon={Package}
          title={t("emptyTitle")}
          description={t("emptyHint")}
        />
      : (
        <ul className="flex flex-col gap-4">
          {offerings.map((row) => (
            <OrganizationOfferingCabinetCard
              key={row.id}
              offering={row}
              organizationId={organizationId}
              sdk={sdk}
              format={format}
              t={t}
              categoryLabel={
                categoryLabelById.get(row.categoryId) ?? t("categoryLabelFallback")
              }
              assignable={assignable}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
