"use client";

import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Package,
  Plus,
  PowerOff,
  Save,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/app/i18n/navigation";
import type { AppLocale } from "@/app/i18n/routing";
import {
  BodyZonesSelector,
  allSelectableBodyZoneSlugsDefault,
  bodyZoneSelectOptionsForServiceCategorySlug,
  getAllowedBodyZoneSlugsForCategorySlug,
  normalizeBodyZoneSlugsForCategory,
} from "@/entities/body-zones";
import { BusinessEmptyState } from "@/entities/business";
import {
  OrganizationCapabilities,
  canOrganization,
  specialistMyOrganizationsQueryKey,
} from "@/entities/organizations";
import {
  catalogGetBodyZonesByMajorSlug,
  catalogGetBulkCategoriesByMajorSlugs,
  createBrowserSdkClient,
  organizationOfferingsCabinetCreateDraft,
  organizationOfferingsCabinetCreatePriceOption,
  organizationOfferingsCabinetDeleteOffering,
  organizationOfferingsCabinetGetOffering,
  organizationOfferingsCabinetPatchOffering,
  organizationOfferingsCabinetPatchPriceOption,
  organizationOfferingsCabinetPublishOffering,
  organizationOfferingsCabinetUnpublishOffering,
  organizationsCabinetGetCabinetOrganizationProfileForEdit,
  specialistsCabinetGetSpecialistMyOrganizations,
} from "@/shared/api";
import {
  cn,
  formatVndAmountInputDisplay,
  parseVndAmountInputToInt,
} from "@/shared/lib";
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
import { slugifyOfferingDraftTitle } from "./organization-offering-draft-create-section";

const CABINET_EDIT_QK = ["organizationCabinetEditProfile"] as const;
const OFFERING_DETAIL_QK = ["organizationOfferingDetail"] as const;
const OFFERINGS_QK = ["organizationOfferingsCabinet"] as const;

type EditorMode = "new" | "edit";

type CategoryOption = {
  id: string;
  slug: string;
  name: string;
  majorSlug: string;
  majorName: string;
};

type NewOfferingPriceRow = {
  rowId: string;
  durationStr: string;
  priceStr: string;
};

function newEmptyOfferingPriceRow(): NewOfferingPriceRow {
  return {
    rowId:
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    durationStr: "",
    priceStr: "",
  };
}

function buildInternalOfferingSlug(title: string): string {
  const base = slugifyOfferingDraftTitle(title) || "offering";
  const suffix =
    globalThis.crypto?.randomUUID?.().replace(/[^a-z0-9]/g, "").slice(0, 8) ??
    Math.random().toString(36).slice(2, 10);
  return `${base.slice(0, 70)}-${suffix}`;
}

/** Подпись секции с номером шага. */
function SectionHeader({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
        {step}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <h2 className="font-heading text-sm font-semibold leading-tight">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

export function BusinessOrganizationOfferingEditorPage({
  mode,
}: {
  mode: EditorMode;
}) {
  const t = useTranslations("businessOrganizationOfferingEditorPage");
  useSetBusinessPageTitle(
    mode === "new" ? t("newPageTitle") : t("editPageTitle"),
  );
  const tList = useTranslations("businessOrganizationOfferingsPage");
  const format = useFormatter();
  const locale = useLocale() as AppLocale;
  const params = useParams<{ organizationId: string; offeringId?: string }>();
  const organizationId = params.organizationId ?? "";
  const offeringId = params.offeringId ?? "";
  const router = useRouter();
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
      const { data, error } =
        await specialistsCabinetGetSpecialistMyOrganizations({ client: sdk });
      if (error || !data) throw error ?? new Error("organizations");
      return data;
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
    canOrganization(membership, OrganizationCapabilities.OFFERINGS_MANAGE);

  const cabinetProfileQuery = useQuery({
    queryKey: [...CABINET_EDIT_QK, organizationId, accessToken, locale] as const,
    enabled: authed && canManage && organizationId.length > 0,
    queryFn: async () => {
      const { data, error } =
        await organizationsCabinetGetCabinetOrganizationProfileForEdit({
          client: sdk,
          path: { organizationId },
          query: { locale },
        });
      if (error || !data) throw error ?? new Error("organization-profile");
      return data;
    },
  });

  const offeringQuery = useQuery({
    queryKey: [
      ...OFFERING_DETAIL_QK,
      organizationId,
      offeringId,
      accessToken,
      locale,
    ] as const,
    enabled: authed && canManage && mode === "edit" && offeringId.length > 0,
    queryFn: async () => {
      const { data, error } = await organizationOfferingsCabinetGetOffering({
        client: sdk,
        path: { organizationId, offeringId },
        query: { locale },
      });
      if (error || !data) throw error ?? new Error("offering");
      return data.offering;
    },
  });

  const majorSlugsCsv = useMemo(
    () =>
      cabinetProfileQuery.data?.majorCategorySlugs
        ?.filter((s) => s.trim().length > 0)
        .join(",")
        .trim() ?? "",
    [cabinetProfileQuery.data?.majorCategorySlugs],
  );

  const catalogQuery = useQuery({
    queryKey: ["catalogBulkCategories", majorSlugsCsv, locale] as const,
    enabled: majorSlugsCsv.length > 0 && canManage,
    queryFn: async () => {
      const { data, error } = await catalogGetBulkCategoriesByMajorSlugs({
        client: sdk,
        query: { majorSlugs: majorSlugsCsv, locale },
      });
      if (error || !data) throw error ?? new Error("catalog");
      return data;
    },
  });

  const categories = useMemo<CategoryOption[]>(() => {
    const rows: CategoryOption[] = [];
    for (const section of catalogQuery.data?.sections ?? []) {
      for (const category of section.categories) {
        rows.push({
          id: category.id,
          slug: category.slug,
          name: category.name,
          majorSlug: section.majorCategory.slug,
          majorName: section.majorCategory.name,
        });
      }
    }
    return rows;
  }, [catalogQuery.data?.sections]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [majorSlug, setMajorSlug] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [selectedBodyZoneSlugs, setSelectedBodyZoneSlugs] = useState<string[]>(
    [],
  );
  const [durationStr, setDurationStr] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [newPriceRows, setNewPriceRows] = useState<NewOfferingPriceRow[]>(() => [
    newEmptyOfferingPriceRow(),
  ]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  /** Чтобы дефолт зон не затирал сохранённые с API и отличать смену категории. */
  const previousCategoryIdForZonesRef = useRef<string>("");
  /** Не затирать локально выставленные дефолты при повторном fetch того же оффера с пустыми bodyZones. */
  const lastOfferingBodyZonesHydrationKeyRef = useRef<string | null>(null);
  /** Поля title/major/category с сервера — только при первом открытии оффера (id), не на каждый refetch. */
  const lastOfferingIdFormSyncedRef = useRef<string | null>(null);
  /** Пользователь сменил категорию — выставить все доступные зоны, как только список slug готов. */
  const pendingApplyAllBodyZonesForCategoryIdRef = useRef<string | null>(null);

  const offering = offeringQuery.data;
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId) ?? null,
    [categories, categoryId],
  );
  const bodyZonesMajorSlug =
    selectedCategory?.majorSlug ?? (majorSlug === "massage" ? "massage" : "");
  const showBodyZones = bodyZonesMajorSlug === "massage";

  const bodyZonesQuery = useQuery({
    queryKey: ["catalogBodyZones", bodyZonesMajorSlug, locale] as const,
    enabled: showBodyZones,
    queryFn: async () => {
      const { data, error } = await catalogGetBodyZonesByMajorSlug({
        client: sdk,
        path: { majorSlug: bodyZonesMajorSlug },
        query: { locale },
      });
      if (error || !data) throw error ?? new Error("body-zones");
      return data.bodyZones;
    },
  });

  /** Есть ли карта зон для slug категории услуг (массаж). */
  const massageCategoryHasBodyZonePolicy = useMemo(() => {
    if (!selectedCategory || selectedCategory.majorSlug !== "massage") {
      return false;
    }
    return getAllowedBodyZoneSlugsForCategorySlug(selectedCategory.slug).length > 0;
  }, [selectedCategory]);

  const bodyZoneSelectorOptions = useMemo(() => {
    if (!selectedCategory || selectedCategory.majorSlug !== "massage") {
      return [];
    }
    const rows = bodyZonesQuery.data ?? [];
    return bodyZoneSelectOptionsForServiceCategorySlug(rows, selectedCategory.slug);
  }, [bodyZonesQuery.data, selectedCategory]);

  const bodyZoneSelectableSlugs = useMemo(
    () => bodyZoneSelectorOptions.map((z) => z.slug),
    [bodyZoneSelectorOptions],
  );

  useEffect(() => {
    if (mode !== "edit" || !offering) {
      lastOfferingBodyZonesHydrationKeyRef.current = null;
      lastOfferingIdFormSyncedRef.current = null;
      return;
    }
    const id = offering.id;
    const isFirstOpenOfThisOffering =
      lastOfferingIdFormSyncedRef.current !== id;
    if (isFirstOpenOfThisOffering) {
      lastOfferingIdFormSyncedRef.current = id;
      setTitle(offering.title);
      setDescription(offering.description ?? "");
      setMajorSlug(offering.category.majorCategory.slug);
      setCategoryId(offering.categoryId);
      pendingApplyAllBodyZonesForCategoryIdRef.current = null;
    }

    const bodyZonesHydrationKey = `${offering.id}:${offering.bodyZones
      .map((z) => z.id)
      .sort()
      .join(",")}`;

    if (lastOfferingBodyZonesHydrationKeyRef.current !== bodyZonesHydrationKey) {
      lastOfferingBodyZonesHydrationKeyRef.current = bodyZonesHydrationKey;
      previousCategoryIdForZonesRef.current = offering.categoryId;
      pendingApplyAllBodyZonesForCategoryIdRef.current = null;
      setSelectedBodyZoneSlugs(
        offering.bodyZones.length > 0
          ? offering.bodyZones.map((z) => z.slug)
          : [],
      );
    }
  }, [mode, offering]);

  /** Сколько slug доступно для категории после подгрузки каталога (0 → N). */
  const prevBodyZoneSelectableSlugsCountRef = useRef(0);
  const lastCategoryIdForBodyZoneOptionsRef = useRef<string>("");
  const previousBodyZoneSelectableSlugsKeyRef = useRef<string>("");

  /* eslint-disable react-hooks/set-state-in-effect -- зоны синхронизируем с категорией и каталогом (дефолт после загрузки API) */
  useEffect(() => {
    if (!categoryId) {
      previousCategoryIdForZonesRef.current = "";
      prevBodyZoneSelectableSlugsCountRef.current = 0;
      lastCategoryIdForBodyZoneOptionsRef.current = "";
      previousBodyZoneSelectableSlugsKeyRef.current = "";
      return;
    }
    if (!selectedCategory) return;

    if (lastCategoryIdForBodyZoneOptionsRef.current !== categoryId) {
      lastCategoryIdForBodyZoneOptionsRef.current = categoryId;
      prevBodyZoneSelectableSlugsCountRef.current = 0;
      previousBodyZoneSelectableSlugsKeyRef.current = "";
    }

    if (selectedCategory.majorSlug !== "massage") {
      previousCategoryIdForZonesRef.current = categoryId;
      previousBodyZoneSelectableSlugsKeyRef.current = "";
      setSelectedBodyZoneSlugs([]);
      return;
    }

    const allowed = getAllowedBodyZoneSlugsForCategorySlug(selectedCategory.slug);
    if (allowed.length === 0) {
      previousCategoryIdForZonesRef.current = categoryId;
      previousBodyZoneSelectableSlugsKeyRef.current = "";
      setSelectedBodyZoneSlugs([]);
      return;
    }

    if (bodyZoneSelectableSlugs.length === 0) {
      return;
    }

    const desired = allSelectableBodyZoneSlugsDefault(bodyZoneSelectableSlugs);
    if (desired.length === 0) {
      return;
    }

    const optionsCount = bodyZoneSelectableSlugs.length;
    const selectableKey = [...bodyZoneSelectableSlugs].sort().join("|");
    const optionsJustFilled =
      prevBodyZoneSelectableSlugsCountRef.current === 0 && optionsCount > 0;

    const pendingApplyId = pendingApplyAllBodyZonesForCategoryIdRef.current;
    if (pendingApplyId != null && pendingApplyId === categoryId) {
      pendingApplyAllBodyZonesForCategoryIdRef.current = null;
      previousCategoryIdForZonesRef.current = categoryId;
      prevBodyZoneSelectableSlugsCountRef.current = optionsCount;
      previousBodyZoneSelectableSlugsKeyRef.current = selectableKey;
      setSelectedBodyZoneSlugs(desired);
      return;
    }

    prevBodyZoneSelectableSlugsCountRef.current = optionsCount;

    const formCategoryMatchesOffering =
      mode !== "edit" ||
      offering == null ||
      offering.categoryId === categoryId;

    setSelectedBodyZoneSlugs((current) => {
      const categoryChanged = previousCategoryIdForZonesRef.current !== categoryId;
      const availableChanged =
        selectableKey.length > 0 &&
        previousBodyZoneSelectableSlugsKeyRef.current.length > 0 &&
        previousBodyZoneSelectableSlugsKeyRef.current !== selectableKey;

      if (categoryChanged || availableChanged) {
        previousCategoryIdForZonesRef.current = categoryId;
        return desired;
      }

      const hasSavedBodyZonesFromApi =
        formCategoryMatchesOffering &&
        mode === "edit" &&
        offering != null &&
        offering.bodyZones.length > 0;

      if (hasSavedBodyZonesFromApi) {
        return normalizeBodyZoneSlugsForCategory({
          selectedSlugs: current,
          categorySlug: selectedCategory.slug,
        });
      }

      if (optionsJustFilled && current.length === 0 && desired.length > 0) {
        return desired;
      }

      const normalized = normalizeBodyZoneSlugsForCategory({
        selectedSlugs: current,
        categorySlug: selectedCategory.slug,
      });
      return normalized.length > 0 ? normalized : current;
    });

    if (selectableKey.length > 0) {
      previousBodyZoneSelectableSlugsKeyRef.current = selectableKey;
    }
  }, [categoryId, selectedCategory, bodyZoneSelectableSlugs, mode, offering]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const bodyZoneIds = useMemo(() => {
    const bySlug = new Map(
      (bodyZonesQuery.data ?? []).map((z) => [z.slug, z.id]),
    );
    return selectedBodyZoneSlugs.flatMap((slugValue) => {
      const id = bySlug.get(slugValue);
      return id ? [id] : [];
    });
  }, [bodyZonesQuery.data, selectedBodyZoneSlugs]);

  const newPriceRowsHaveIncomplete = useMemo(() => {
    if (mode !== "new") return false;
    for (const row of newPriceRows) {
      const d = row.durationStr.trim();
      const priceDigits = row.priceStr.replace(/\D/g, "");
      if (d.length === 0 && priceDigits.length === 0) continue;
      const dm = Number.parseInt(d, 10);
      const pa = parseVndAmountInputToInt(row.priceStr);
      if (
        d.length === 0 ||
        priceDigits.length === 0 ||
        !Number.isFinite(dm) ||
        dm <= 0 ||
        pa === null ||
        pa < 0
      ) {
        return true;
      }
    }
    return false;
  }, [mode, newPriceRows]);

  const invalidateBundle = (): void => {
    void queryClient.invalidateQueries({ queryKey: OFFERINGS_QK });
    void queryClient.invalidateQueries({ queryKey: OFFERING_DETAIL_QK });
  };

  const saveMut = useMutation({
    mutationFn: async (newRowsForCreate?: NewOfferingPriceRow[]) => {
      if (mode === "new") {
        const { data, error } = await organizationOfferingsCabinetCreateDraft({
          client: sdk,
          path: { organizationId },
          body: {
            title: title.trim(),
            slug: buildInternalOfferingSlug(title),
            categoryId,
            description: description.trim() || null,
            bodyZoneIds,
          },
        });
        if (error || !data) throw error ?? new Error("create");
        const createdId = data.id;
        const rows = newRowsForCreate ?? [];
        for (const row of rows) {
          const durationMinutes = Number.parseInt(row.durationStr.trim(), 10);
          const priceAmount = parseVndAmountInputToInt(row.priceStr);
          if (
            !Number.isFinite(durationMinutes) ||
            durationMinutes <= 0 ||
            priceAmount === null ||
            priceAmount < 0
          ) {
            continue;
          }
          const { error: priceErr } =
            await organizationOfferingsCabinetCreatePriceOption({
              client: sdk,
              path: { organizationId, offeringId: createdId },
              body: { durationMinutes, priceAmount, currency: "VND" },
            });
          if (priceErr) throw priceErr;
        }
        return createdId;
      }
      const { error } = await organizationOfferingsCabinetPatchOffering({
        client: sdk,
        path: { organizationId, offeringId },
        body: {
          title: title.trim(),
          categoryId,
          description: description.trim() || null,
          bodyZoneIds,
        },
      });
      if (error) throw error;
      return offeringId;
    },
    onSuccess: (savedId) => {
      invalidateBundle();
      if (mode === "new") {
        router.push(
          `/business/organizations/${organizationId}/offerings/${savedId}`,
        );
      }
    },
  });

  const addPriceMut = useMutation({
    mutationFn: async () => {
      const durationMinutes = Number.parseInt(durationStr.trim(), 10);
      const priceAmount = parseVndAmountInputToInt(priceStr);
      if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
        throw new Error("duration");
      }
      if (priceAmount === null || priceAmount < 0) {
        throw new Error("price");
      }
      const { error } = await organizationOfferingsCabinetCreatePriceOption({
        client: sdk,
        path: { organizationId, offeringId },
        body: { durationMinutes, priceAmount, currency: "VND" },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDurationStr("");
      setPriceStr("");
      invalidateBundle();
    },
  });

  const removePriceMut = useMutation({
    mutationFn: async (optionId: string) => {
      const { error } = await organizationOfferingsCabinetPatchPriceOption({
        client: sdk,
        path: { organizationId, offeringId, optionId },
        body: { remove: true },
      });
      if (error) throw error;
    },
    onSuccess: invalidateBundle,
  });

  const publishMut = useMutation({
    mutationFn: async () => {
      const { error } = await organizationOfferingsCabinetPublishOffering({
        client: sdk,
        path: { organizationId, offeringId },
      });
      if (error) throw error;
    },
    onSuccess: invalidateBundle,
  });

  const unpublishMut = useMutation({
    mutationFn: async () => {
      const { error } = await organizationOfferingsCabinetUnpublishOffering({
        client: sdk,
        path: { organizationId, offeringId },
      });
      if (error) throw error;
    },
    onSuccess: invalidateBundle,
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      const { error } = await organizationOfferingsCabinetDeleteOffering({
        client: sdk,
        path: { organizationId, offeringId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: OFFERINGS_QK });
      void queryClient.invalidateQueries({ queryKey: OFFERING_DETAIL_QK });
      setDeleteDialogOpen(false);
      router.push(`/business/organizations/${organizationId}/offerings`);
    },
  });

  const firstPublished = Boolean(offering?.firstPublishedAt);
  const canPublishGate =
    mode === "edit" &&
    Boolean(
      offering?.priceOptions.some(
        (o) => o.status === "active" && o.currency === "VND",
      ),
    );
  const saveDisabled =
    saveMut.isPending ||
    title.trim().length === 0 ||
    categoryId.trim().length === 0 ||
    newPriceRowsHaveIncomplete;

  // ── Loading state ───────────────────────────────────────────────────────────
  if (
    sessionStatus === "loading" ||
    membershipsQuery.isPending ||
    (canManage && cabinetProfileQuery.isPending) ||
    (mode === "edit" && offeringQuery.isPending)
  ) {
    return (
      <main className="flex w-full min-h-0 flex-1 flex-col gap-5 px-4 pt-2">
        <div className="space-y-4">
          <div className="h-8 w-40 animate-pulse rounded-xl bg-muted/50" />
          <div className="h-[180px] animate-pulse rounded-2xl bg-muted/40" />
          <div className="h-[140px] animate-pulse rounded-2xl bg-muted/40" />
          <div className="h-[120px] animate-pulse rounded-2xl bg-muted/40" />
        </div>
      </main>
    );
  }

  // ── Auth / permission guards ────────────────────────────────────────────────
  if (sessionStatus === "unauthenticated" || !accessToken) {
    return (
      <main className="flex w-full min-h-0 flex-1 flex-col gap-5 px-4 pt-2">
        <BusinessEmptyState
          icon={Package}
          title={tList("signInTitle")}
          description={tList("signInHint")}
        />
      </main>
    );
  }

  if (!canManage || membershipsQuery.isError || !membership) {
    return (
      <main className="flex w-full min-h-0 flex-1 flex-col gap-5 px-4 pt-2">
        <BusinessEmptyState
          icon={Package}
          title={t("forbiddenTitle")}
          description={t("forbiddenHint")}
        />
      </main>
    );
  }

  if (cabinetProfileQuery.isError || offeringQuery.isError) {
    return (
      <main className="flex w-full min-h-0 flex-1 flex-col gap-5 px-4 pt-2">
        <BusinessEmptyState
          icon={Package}
          title={t("loadErrorTitle")}
          description={t("loadErrorHint")}
        />
      </main>
    );
  }

  const categoriesForMajor = categories.filter((c) => c.majorSlug === majorSlug);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <main className="flex w-full min-h-0 flex-1 flex-col gap-5 px-4 pt-2">
      {/* Top navigation bar */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2 gap-1.5 rounded-xl px-2 text-muted-foreground hover:text-foreground"
          >
            <Link
              href={`/business/organizations/${organizationId}/offerings`}
            >
              <ArrowLeft className="size-4" aria-hidden />
              {t("backToServices")}
            </Link>
          </Button>
          {mode === "new" ? (
            <>
              <h1 className="font-heading text-xl font-semibold tracking-tight">
                {t("newPageTitle")}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("newPageHint")}
              </p>
            </>
          ) : null}
        </div>

        {/* Publication controls (edit mode only) */}
        {mode === "edit" ? (
          <div className="flex items-center gap-2">
            {offering?.publicationStatus === "published" ? (
              <div className="flex items-center gap-2">
                <span className="flex h-8 items-center gap-1.5 rounded-full bg-emerald-500/12 px-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-emerald-500"
                    aria-hidden
                  />
                  {tList("statusPublished")}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  tone="light"
                  className="h-8 gap-1.5 rounded-xl border border-amber-500/40 px-3 text-xs text-amber-700 hover:bg-amber-500/8 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-400"
                  disabled={unpublishMut.isPending}
                  onClick={() => void unpublishMut.mutate()}
                >
                  {unpublishMut.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <PowerOff className="size-3.5" aria-hidden />
                  )}
                  {tList("unpublish")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1.5 rounded-xl px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  {tList("deleteService")}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="flex h-8 items-center rounded-full bg-muted px-2.5 text-xs font-medium text-muted-foreground">
                  {offering?.publicationStatus === "hidden"
                    ? tList("statusHidden")
                    : tList("statusDraft")}
                </span>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1.5 rounded-xl px-3 text-xs"
                  disabled={!canPublishGate || publishMut.isPending}
                  onClick={() => void publishMut.mutate()}
                >
                  {publishMut.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <UploadCloud className="size-3.5" aria-hidden />
                  )}
                  {tList("publish")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1.5 rounded-xl px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  {tList("deleteService")}
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* ── Section 1: Basic information ── */}
      <section className="rounded-2xl border border-border/60 bg-card p-5 text-card-foreground">
        <SectionHeader
          step={1}
          title={t("sectionBasicTitle")}
          description={t("sectionBasicHint")}
        />

        <div className="mt-4 space-y-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-muted-foreground">
              {tList("fieldTitle")}
              <span className="ml-0.5 text-destructive">*</span>
            </span>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("titlePlaceholder")}
              className="rounded-xl"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-muted-foreground">
              {tList("fieldDescription")}
            </span>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
              className="min-h-[5rem] resize-none rounded-xl"
            />
          </label>
        </div>
      </section>

      {/* ── Section 2: Category & body zones ── */}
      <section className="rounded-2xl border border-border/60 bg-card p-5 text-card-foreground">
        <SectionHeader
          step={2}
          title={t("sectionCategoryTitle")}
          description={
            firstPublished ? t("editCategoryLockedHint") : t("sectionCategoryHint")
          }
        />

        <div className="mt-4">
          {/* Category cascade breadcrumb */}
          <div className="flex items-center gap-2 rounded-xl bg-muted/30 p-1 text-sm">
            <div className="flex-1">
              <Select
                value={majorSlug}
                onValueChange={(value) => {
                  setMajorSlug(value);
                  setCategoryId("");
                  setSelectedBodyZoneSlugs([]);
                  pendingApplyAllBodyZonesForCategoryIdRef.current = null;
                }}
                disabled={firstPublished}
              >
                <SelectTrigger className="rounded-lg border-none bg-transparent shadow-none ring-0 focus:ring-0">
                  <SelectValue placeholder={t("fieldMajorPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {(catalogQuery.data?.sections ?? []).map((section) => (
                    <SelectItem
                      key={section.majorCategory.slug}
                      value={section.majorCategory.slug}
                    >
                      {section.majorCategory.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ChevronRight
              className="size-4 shrink-0 text-muted-foreground/50"
              aria-hidden
            />
            <div className="flex-1">
              <Select
                value={categoryId}
                onValueChange={(nextCategoryId) => {
                  setCategoryId(nextCategoryId);
                  pendingApplyAllBodyZonesForCategoryIdRef.current =
                    nextCategoryId;
                }}
                disabled={firstPublished || majorSlug.length === 0}
              >
                <SelectTrigger className="rounded-lg border-none bg-transparent shadow-none ring-0 focus:ring-0">
                  <SelectValue placeholder={tList("fieldCategoryPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {categoriesForMajor.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Body zones */}
          {showBodyZones ? (
            <div className="mt-4">
              {!selectedCategory ? (
                <p
                  className="text-pretty text-sm text-muted-foreground"
                  role="note"
                >
                  {t("bodyZonesPickCategoryHint")}
                </p>
              ) : !massageCategoryHasBodyZonePolicy ? (
                <p
                  className="text-pretty text-sm text-muted-foreground"
                  role="note"
                >
                  {t("bodyZonesNoZonesForCategoryHint")}
                </p>
              ) : (
                <BodyZonesSelector
                  zones={bodyZoneSelectorOptions}
                  selectedSlugs={selectedBodyZoneSlugs}
                  onChangeSelectedSlugs={setSelectedBodyZoneSlugs}
                  disabled={
                    bodyZonesQuery.isPending ||
                    bodyZonesQuery.isError ||
                    bodyZoneSelectableSlugs.length === 0
                  }
                />
              )}
            </div>
          ) : null}
        </div>
      </section>

      {/* ── Section 3: Prices (inline for new, separate for edit) ── */}
      {mode === "new" ? (
        <section className="rounded-2xl border border-border/60 bg-card p-5 text-card-foreground">
          <SectionHeader
            step={3}
            title={t("pricesTitle")}
            description={t("newPricesOptionalHint")}
          />

          <ul className="mt-4 space-y-2">
            {newPriceRows.map((row, idx) => (
              <li
                key={row.rowId}
                className="grid gap-2 rounded-xl border border-border/40 bg-muted/20 p-3 md:grid-cols-[1fr_1fr_auto] md:items-end"
              >
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-xs font-medium text-muted-foreground">
                    {tList("durationLabel")}
                  </span>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={row.durationStr}
                    placeholder="60"
                    onChange={(e) => {
                      const value = e.target.value;
                      setNewPriceRows((current) =>
                        current.map((r) =>
                          r.rowId === row.rowId
                            ? { ...r, durationStr: value }
                            : r,
                        ),
                      );
                    }}
                    onBlur={() => {
                      setNewPriceRows((current) =>
                        current.map((r) => {
                          if (r.rowId !== row.rowId) return r;
                          const s = r.durationStr.trim();
                          if (s.length === 0) return r;
                          const n = Number.parseInt(s, 10);
                          if (!Number.isFinite(n) || n < 1) {
                            return { ...r, durationStr: "" };
                          }
                          return { ...r, durationStr: String(n) };
                        }),
                      );
                    }}
                    className="rounded-xl tabular-nums"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-xs font-medium text-muted-foreground">
                    {tList("priceLabel")}
                  </span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder={t("priceVndPlaceholder")}
                    value={row.priceStr}
                    onChange={(e) => {
                      const value = formatVndAmountInputDisplay(e.target.value);
                      setNewPriceRows((current) =>
                        current.map((r) =>
                          r.rowId === row.rowId ? { ...r, priceStr: value } : r,
                        ),
                      );
                    }}
                    className="rounded-xl tabular-nums"
                  />
                </label>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-9 rounded-xl opacity-60 hover:opacity-100 md:justify-self-end"
                  disabled={newPriceRows.length <= 1}
                  aria-label={`${tList("removeOptionAria")} ${idx + 1}`}
                  onClick={() => {
                    setNewPriceRows((current) =>
                      current.length <= 1
                        ? current
                        : current.filter((r) => r.rowId !== row.rowId),
                    );
                  }}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 h-8 gap-1.5 rounded-xl px-2.5 text-xs"
            onClick={() =>
              setNewPriceRows((r) => [...r, newEmptyOfferingPriceRow()])
            }
          >
            <Plus className="size-3.5" aria-hidden />
            {tList("addOption")}
          </Button>

          {newPriceRowsHaveIncomplete ? (
            <p
              className="mt-2 text-pretty text-xs text-destructive"
              role="alert"
            >
              {t("newPricesIncompleteHint")}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* ── Section: Edit price options (edit mode only) ── */}
      {mode === "edit" && offering ? (
        <section className="rounded-2xl border border-border/60 bg-card p-5 text-card-foreground">
          <SectionHeader
            step={3}
            title={t("pricesTitle")}
            description={
              !canPublishGate
                ? tList("publishBlockedHint")
                : undefined
            }
          />

          {offering.priceOptions.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {offering.priceOptions.map((po) => (
                <li
                  key={po.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5 text-sm"
                >
                  <div className="flex items-center gap-2 tabular-nums">
                    <span className="font-medium">
                      {tList("optionMinutes", {
                        minutes: po.durationMinutes,
                        price:
                          po.currency === "VND"
                            ? format.number(po.priceAmount, {
                                style: "currency",
                                currency: "VND",
                                currencyDisplay: "narrowSymbol",
                              })
                            : format.number(po.priceAmount),
                      })}
                    </span>
                    {po.status !== "active" ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {tList("optionStatusOther", { status: po.status })}
                      </span>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8 rounded-xl opacity-60 hover:opacity-100"
                    disabled={removePriceMut.isPending}
                    aria-label={tList("removeOptionAria")}
                    onClick={() => void removePriceMut.mutate(po.id)}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              {tList("noPriceOptions")}
            </p>
          )}

          {/* Add new price option inline */}
          <div className="mt-4 grid gap-2 rounded-xl border border-dashed border-border/60 bg-muted/10 p-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs font-medium text-muted-foreground">
                {tList("durationLabel")}
              </span>
              <Input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                placeholder="60"
                value={durationStr}
                onChange={(e) => setDurationStr(e.target.value)}
                onBlur={() => {
                  const s = durationStr.trim();
                  if (s.length === 0) return;
                  const n = Number.parseInt(s, 10);
                  if (!Number.isFinite(n) || n < 1) {
                    setDurationStr("");
                    return;
                  }
                  setDurationStr(String(n));
                }}
                className={cn("rounded-xl tabular-nums")}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs font-medium text-muted-foreground">
                {tList("priceLabel")}
              </span>
              <Input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder={t("priceVndPlaceholder")}
                value={priceStr}
                onChange={(e) =>
                  setPriceStr(formatVndAmountInputDisplay(e.target.value))
                }
                className={cn("rounded-xl tabular-nums")}
              />
            </label>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-9 gap-1.5 rounded-xl px-3 md:self-end"
              disabled={addPriceMut.isPending}
              onClick={() => void addPriceMut.mutate()}
            >
              {addPriceMut.isPending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Plus className="size-3.5" aria-hidden />
              )}
              {tList("addOption")}
            </Button>
          </div>
        </section>
      ) : null}

      {/* ── Save button ── */}
      <div className="rounded-2xl border border-border/40 bg-muted/15 p-4">
        <Button
          type="button"
          className="w-full rounded-xl"
          size="lg"
          disabled={saveDisabled}
          onClick={() =>
            void saveMut.mutate(mode === "new" ? newPriceRows : undefined)
          }
        >
          {saveMut.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : saveMut.isSuccess && mode === "edit" ? (
            <CheckCircle2 className="size-4" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}
          {mode === "new" ? t("saveDraft") : t("saveChanges")}
        </Button>
        {mode === "new" && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {t("saveDraftHint")}
          </p>
        )}
      </div>

      {/* ── Delete confirmation dialog ── */}
      {mode === "edit" ? (
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>{tList("deleteServiceConfirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription className="text-pretty">
                {tList("deleteServiceConfirmDescription")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                tone="muted"
                className="rounded-xl"
                onClick={() => setDeleteDialogOpen(false)}
              >
                {tList("deleteServiceCancel")}
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
                {tList("deleteServiceConfirm")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </main>
  );
}
