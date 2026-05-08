"use client";

import { Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { AppLocale } from "@/app/i18n/routing";
import { useRouter } from "@/app/i18n/navigation";
import {
  createBrowserSdkClient,
  directoryGetCatalogFilterOptions,
  specialistsCabinetPatchSpecialistPersonalService,
  specialistsCabinetPostSpecialistPersonalService,
} from "@/shared/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from "@/shared/ui";
import {
  SpecialistPersonalServiceFields,
  defaultSvc,
  DURATION_MINUTES_MAX,
  DURATION_MINUTES_MIN,
  type DurPrice,
  type SvcForm,
} from "@/entities/specialists";
import { defaultBodyZoneSlugsForCategorySlug } from "@/entities/body-zones";
import type { CatalogCategoryWithMajor } from "@/views/business/setup/lib/personal-catalog-categories-core";
import { useBusinessPersonalServiceCatalogCategories } from "../lib/use-business-personal-catalog-categories";

const ONB_QK = ["specialistOnboarding"] as const;

export type BusinessPersonalServiceFormProps = {
  mode: "create" | "edit";
  serviceId?: string;
  initial?: {
    categoryId: string;
    kind?: "standard" | "combo";
    comboCategoryIds?: string[];
    bodyZoneSlugs?: string[];
    priceOptions: Array<{ durationMinutes: number; priceAmount: number }>;
  };
};

function isValidDraft(s: SvcForm): boolean {
  if (!s.categoryId || s.durationPrices.length === 0) {
    return false;
  }
  if (s.kind === "combo" && s.comboCategoryIds.length < 1) {
    return false;
  }
  for (const d of s.durationPrices) {
    if (
      !Number.isInteger(d.minutes) ||
      d.minutes < DURATION_MINUTES_MIN ||
      d.minutes > DURATION_MINUTES_MAX
    ) {
      return false;
    }
    const digits = String(d.priceVnd).replace(/\D/g, "");
    const n = digits.length > 0 ? Number(digits) : Number.NaN;
    if (!Number.isFinite(n) || n < 1) {
      return false;
    }
  }
  return true;
}

function priceOptionsFromInitial(
  rows: Array<{ durationMinutes: number; priceAmount: number }>,
): DurPrice[] {
  return rows.map((r) => ({
    minutes: r.durationMinutes,
    priceVnd: String(Math.round(r.priceAmount)),
  }));
}

function categoriesOfMajorSlug(
  categories: CatalogCategoryWithMajor[],
  slug: string,
): CatalogCategoryWithMajor[] {
  return categories.filter((c) => c.majorSlug === slug);
}

/**
 * Форма создания / редактирования личной услуги мастера (POST или PATCH).
 * Выбор большой категории и фильтрация подкатегорий — как на шаге услуг онбординга.
 */
export function BusinessPersonalServiceForm({
  mode,
  serviceId,
  initial,
}: BusinessPersonalServiceFormProps) {
  const t = useTranslations("businessServicesPage");
  const tOnb = useTranslations("specialistOnboarding");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken ?? "";

  const sdk = useMemo(
    () => createBrowserSdkClient(accessToken, { locale }),
    [accessToken, locale],
  );

  const catalogQuery = useBusinessPersonalServiceCatalogCategories(
    status === "authenticated" && accessToken.length > 0,
  );

  const majors = useMemo(
    () => catalogQuery.data?.majors ?? [],
    [catalogQuery.data?.majors],
  );
  const categories = useMemo(
    () => catalogQuery.data?.categories ?? [],
    [catalogQuery.data?.categories],
  );

  const categoryMajorById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) {
      m.set(c.id, c.majorSlug);
    }
    return m;
  }, [categories]);

  const fallbackMajorSlug = majors[0]?.slug ?? "";

  const bodyZonesQuery = useQuery({
    queryKey: ["businessServiceBodyZones", locale, accessToken],
    enabled: status === "authenticated" && accessToken.length > 0,
    queryFn: async () => {
      const { data, error } = await directoryGetCatalogFilterOptions({
        client: sdk,
        query: { locale, tab: "specialists" },
      });
      if (error || !data) {
        throw new Error("body-zones");
      }
      return (
        (
          data as {
            bodyZones?: Array<{ slug: string; name: string }>;
          }
        ).bodyZones ?? []
      );
    },
  });
  const bodyZoneOptions = bodyZonesQuery.data ?? [];

  const [draft, setDraft] = useState<SvcForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const hydratedRef = useRef(false);

  useLayoutEffect(() => {
    hydratedRef.current = false;
  }, [mode, serviceId, initial]);

  /* Гидратация черновика после загрузки каталога (как onboarding `setServices`). */
  /* eslint-disable react-hooks/set-state-in-effect */
  useLayoutEffect(() => {
    if (
      catalogQuery.workplaceMajorsEmpty ||
      !majors.length ||
      !categories.length ||
      hydratedRef.current
    ) {
      return;
    }
    if (mode === "edit" && initial != null) {
      setDraft({
        categoryId: initial.categoryId,
        kind: initial.kind ?? "standard",
        comboCategoryIds: initial.comboCategoryIds ?? [],
        bodyZoneSlugs: initial.bodyZoneSlugs ?? [],
        durationPrices:
          initial.priceOptions.length > 0 ?
            priceOptionsFromInitial(initial.priceOptions)
          : [{ minutes: 60, priceVnd: "" }],
      });
      hydratedRef.current = true;
      return;
    }
    if (mode === "create") {
      const firstMajorSlug = majors[0]!.slug;
      const firstCat = categories.find((c) => c.majorSlug === firstMajorSlug);
      if (!firstCat) {
        return;
      }
      setDraft({
        ...defaultSvc(firstCat.id, { majorSlug: firstMajorSlug }),
        bodyZoneSlugs: defaultBodyZoneSlugsForCategorySlug(firstCat.slug),
      });
      hydratedRef.current = true;
    }
  }, [
    catalogQuery.workplaceMajorsEmpty,
    categories,
    initial,
    majors,
    mode,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (draft == null || !isValidDraft(draft)) {
        throw new Error("validation");
      }
      const priceOptions = draft.durationPrices.map((d) => ({
        durationMinutes: d.minutes,
        priceAmount: Math.round(Number(String(d.priceVnd).replace(/\D/g, ""))),
      }));
      const body = {
        categoryId: draft.categoryId,
        kind: draft.kind,
        ...(draft.comboCategoryIds.length > 0 ?
          ({ comboCategoryIds: draft.comboCategoryIds } as Record<string, unknown>)
        : {}),
        ...(draft.bodyZoneSlugs.length > 0 ?
          ({ bodyZoneSlugs: draft.bodyZoneSlugs } as Record<string, unknown>)
        : {}),
        priceOptions: priceOptions.map((o) => ({ ...o, currency: "VND" as const })),
      } as unknown as NonNullable<
        Parameters<typeof specialistsCabinetPostSpecialistPersonalService>[0]["body"]
      >;
      if (mode === "edit") {
        if (serviceId == null || serviceId.length === 0) {
          throw new Error("validation");
        }
        const { error } =
          await specialistsCabinetPatchSpecialistPersonalService({
            client: sdk,
            query: { locale },
            path: { serviceId },
            body,
          });
        if (error) {
          throw new Error("api");
        }
        return;
      }
      const { error } = await specialistsCabinetPostSpecialistPersonalService({
        client: sdk,
        query: { locale },
        body,
      });
      if (error) {
        throw new Error("api");
      }
    },
    onSuccess: async () => {
      setFormError(null);
      await queryClient.invalidateQueries({
        queryKey: [...ONB_QK, accessToken, locale],
      });
      router.push("/business/services");
    },
    onError: (e: Error) => {
      setFormError(
        e.message === "validation" ? t("formError") : tOnb("vErrService"),
      );
    },
  });

  if (catalogQuery.workplaceMajorsEmpty) {
    return (
      <div className="space-y-3 rounded-xl border border-border/45 bg-muted/12 px-4 py-5 dark:bg-muted/18">
        <h2 className="font-heading text-base font-semibold text-foreground">
          {tOnb("stepServicesWorkplaceMajorsEmptyTitle")}
        </h2>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          {tOnb("stepServicesWorkplaceMajorsEmptyHint")}
        </p>
      </div>
    );
  }

  if (catalogQuery.isLoading || draft == null) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground" aria-busy>
        <Loader2 className="size-8 animate-spin" aria-hidden />
      </div>
    );
  }

  if (catalogQuery.isError) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-border/45 bg-muted/12 px-4 py-5 dark:bg-muted/18">
        <p className="text-sm text-muted-foreground">{t("catalogError")}</p>
        <Button
          type="button"
          variant="secondary"
          tone="light"
          className="h-11 rounded-xl border border-border"
          onClick={() => void catalogQuery.refetch()}
        >
          {t("catalogRetry")}
        </Button>
      </div>
    );
  }

  if (!majors.length || !categories.length) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-border/45 bg-muted/12 px-4 py-5 dark:bg-muted/18">
        <p className="text-sm text-muted-foreground">{t("catalogError")}</p>
        <Button
          type="button"
          variant="secondary"
          tone="light"
          className="h-11 rounded-xl border border-border"
          onClick={() => void catalogQuery.refetch()}
        >
          {t("catalogRetry")}
        </Button>
      </div>
    );
  }

  const catMajor = categoryMajorById.get(draft.categoryId);
  const rowMajorResolved = catMajor ?? fallbackMajorSlug;
  const categoriesForRow = categoriesOfMajorSlug(
    categories,
    rowMajorResolved,
  );

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-xl border border-border/45 bg-muted/12 px-3 py-4 dark:bg-muted/18">
        <div className="space-y-1.5">
          <span className="text-sm font-medium text-foreground">
            {tOnb("servicesMajorSphereLabel")}
          </span>
          <Select
            value={rowMajorResolved}
            disabled={submitMutation.isPending}
            onValueChange={(nextSlug) => {
              const firstCat = categories.find((c) => c.majorSlug === nextSlug);
              if (!firstCat) {
                return;
              }
              setDraft({
                ...defaultSvc(firstCat.id, { majorSlug: nextSlug }),
                bodyZoneSlugs: defaultBodyZoneSlugsForCategorySlug(
                  firstCat.slug,
                ),
              });
            }}
          >
            <SelectTrigger className="h-12 w-full min-w-0 rounded-2xl border-0 bg-muted/45">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[min(70vh,28rem)]">
              {majors.map((m) => (
                <SelectItem key={m.slug} value={m.slug}>
                  <span className="font-medium text-foreground">{m.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <SpecialistPersonalServiceFields
          categories={categoriesForRow}
          value={draft}
          disabled={submitMutation.isPending}
          categoryLabelVariant="compact"
          onChange={setDraft}
          bodyZoneOptions={bodyZoneOptions}
        />
      </div>

      {formError ?
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      : null}

      <Separator className="bg-border/40" />

      <Button
        type="button"
        variant="primary"
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl"
        disabled={submitMutation.isPending}
        onClick={() => {
          setFormError(null);
          submitMutation.mutate();
        }}
      >
        {submitMutation.isPending ?
          <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
        : null}
        {mode === "edit" ? t("saveEdit") : t("saveNew")}
      </Button>
    </div>
  );
}
