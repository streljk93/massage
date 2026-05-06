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
import { Button, Separator } from "@/shared/ui";
import {
  SpecialistPersonalServiceFields,
  defaultSvc,
  DURATION_MINUTES_MAX,
  DURATION_MINUTES_MIN,
  type DurPrice,
  type SvcForm,
} from "@/entities/specialists";
import { defaultBodyZoneSlugsForCategorySlug } from "@/entities/body-zones";
import { useBusinessCabinetCatalogCategories } from "../lib/use-business-catalog-categories";

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

/**
 * Форма создания / редактирования личной услуги мастера (POST или PATCH).
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

  const catalogQuery = useBusinessCabinetCatalogCategories(
    status === "authenticated" && accessToken.length > 0,
  );

  const categories = catalogQuery.data ?? [];
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
      return (data as { bodyZones?: Array<{ slug: string; name: string }> }).bodyZones ?? [];
    },
  });
  const bodyZoneOptions = bodyZonesQuery.data ?? [];

  const [draft, setDraft] = useState<SvcForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const hydratedRef = useRef(false);

  useLayoutEffect(() => {
    hydratedRef.current = false;
  }, [mode, serviceId, initial]);

  useLayoutEffect(() => {
    if (!categories.length || hydratedRef.current) {
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
      const first = categories[0]!;
      setDraft({
        ...defaultSvc(first.id),
        bodyZoneSlugs: defaultBodyZoneSlugsForCategorySlug(first.slug),
      });
      hydratedRef.current = true;
    }
  }, [categories, mode, initial]);

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
        ...(draft.comboCategoryIds.length > 0 ? ({ comboCategoryIds: draft.comboCategoryIds } as Record<string, unknown>) : {}),
        ...(draft.bodyZoneSlugs.length > 0 ? ({ bodyZoneSlugs: draft.bodyZoneSlugs } as Record<string, unknown>) : {}),
        priceOptions: priceOptions.map((o) => ({ ...o, currency: "VND" as const })),
      } as unknown as NonNullable<
        Parameters<typeof specialistsCabinetPostSpecialistPersonalService>[0]["body"]
      >;
      if (mode === "edit") {
        if (serviceId == null || serviceId.length === 0) {
          throw new Error("validation");
        }
        const { error } = await specialistsCabinetPatchSpecialistPersonalService({
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

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-xl border border-border/45 bg-muted/12 px-3 py-4 dark:bg-muted/18">
        <SpecialistPersonalServiceFields
          categories={categories}
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
