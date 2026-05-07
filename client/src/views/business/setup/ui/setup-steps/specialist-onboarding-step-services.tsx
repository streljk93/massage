"use client";

import { useLayoutEffect, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Plus, Sparkles } from "lucide-react";
import { SpecialistPersonalServiceFields } from "@/entities/specialists";
import { defaultBodyZoneSlugsForCategorySlug } from "@/entities/body-zones";
import { cn } from "@/shared/lib";
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from "@/shared/ui";
import {
  defaultSvc,
  type Cat,
} from "../../lib/specialist-onboarding-utils";
import { useSpecialistOnboardingCatalogCategories } from "../../lib/use-specialist-onboarding-catalog-categories";
import { useSpecialistOnboarding } from "../specialist-onboarding-context";
import { directoryGetCatalogFilterOptions } from "@/shared/api";
import type { AppLocale } from "@/app/i18n/routing";

function categoriesOfMajorSlug(
  categories: Array<Cat & { majorSlug?: string }>,
  slug: string,
): Cat[] {
  return categories.filter((c) => c.majorSlug === slug);
}

export default function SpecialistOnboardingStepServices() {
  const t = useTranslations("specialistOnboarding");
  const locale = useLocale() as AppLocale;
  const {
    spec,
    accessToken,
    ready,
    sdk,
    services,
    setServices,
    servicesSubmitting,
    removeService,
    updateSvc,
    isServicePanelOpen,
    setServicePanelOpen,
  } = useSpecialistOnboarding();
  const workplaceMajorsEmpty =
    spec?.activeOrganizationId != null &&
    spec.activeOrganizationId !== "" &&
    Array.isArray(spec.activeWorkplaceMajorCategorySlugs) &&
    spec.activeWorkplaceMajorCategorySlugs.length === 0;

  const catalogQuery = useSpecialistOnboardingCatalogCategories(true);
  const catalog = catalogQuery.data;
  const { isLoading } = catalogQuery;

  const majors = catalog?.majors ?? [];
  const categories = catalog?.categories ?? [];

  const categoryMajorById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) {
      m.set(c.id, c.majorSlug);
    }
    return m;
  }, [categories]);

  const fallbackMajorSlug = majors[0]?.slug ?? "";

  const bodyZonesQuery = useQuery({
    queryKey: ["onboardingBodyZones", locale, accessToken],
    enabled: ready && accessToken.length > 0,
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

  useLayoutEffect(() => {
    if (!categories.length || workplaceMajorsEmpty || !majors.length) {
      return;
    }
    const firstMajor = majors[0]!.slug;
    const firstCat = categories.find((c) => c.majorSlug === firstMajor);
    if (!firstCat) {
      return;
    }
    setServices((prev) =>
      prev.length > 0 ?
        prev
      : [
          {
            ...defaultSvc(firstCat.id, { majorSlug: firstMajor }),
            bodyZoneSlugs: defaultBodyZoneSlugsForCategorySlug(firstCat.slug),
          },
        ],
    );
  }, [categories, majors, setServices, workplaceMajorsEmpty]);

  const addService = () => {
    if (!fallbackMajorSlug) {
      return;
    }
    const firstCat = categories.find((c) => c.majorSlug === fallbackMajorSlug);
    if (!firstCat) {
      return;
    }
    setServices((prev) => [
      ...prev,
      {
        ...defaultSvc(firstCat.id, { majorSlug: fallbackMajorSlug }),
        bodyZoneSlugs: defaultBodyZoneSlugsForCategorySlug(firstCat.slug),
      },
    ]);
  };

  if (workplaceMajorsEmpty) {
    return (
      <section className="space-y-4">
        <div className="space-y-3 rounded-3xl border border-border/50 bg-muted/20 p-5">
          <h1 className="font-heading text-xl font-semibold text-foreground">
            {t("stepServicesWorkplaceMajorsEmptyTitle")}
          </h1>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            {t("stepServicesWorkplaceMajorsEmptyHint")}
          </p>
        </div>
      </section>
    );
  }

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-3xl bg-muted/40" aria-busy />;
  }

  if (!categories.length || !majors.length) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="space-y-3 rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.09] via-background/80 to-amber-500/[0.08] p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1.5">
            <h1 className="font-heading text-2xl font-semibold leading-tight tracking-tight text-foreground">
              {t("step4Title")}
            </h1>
            <p className="text-pretty text-[0.9375rem] leading-relaxed text-muted-foreground">
              {t("step4Sub")}
            </p>
          </div>
        </div>
      </div>

      {services.map((s, si) => {
        const catMajor = categoryMajorById.get(s.categoryId);
        const rowMajorResolved = catMajor ?? fallbackMajorSlug;
        const categoriesForRow = categoriesOfMajorSlug(
          categories,
          rowMajorResolved,
        );

        const open = isServicePanelOpen(si);
        return (
          <Collapsible
            key={si}
            open={open}
            onOpenChange={(next) =>
              setServicePanelOpen((prev) => ({ ...prev, [si]: next }))
            }
            className="overflow-hidden rounded-3xl border border-border/40 bg-card/60 ring-1 ring-border/30"
          >
            <CollapsibleTrigger
              className="flex w-full touch-manipulation items-center justify-between gap-2 px-4 py-3.5 text-left transition-colors outline-none hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
              id={`service-panel-heading-${si}`}
            >
              <h2 className="font-heading text-sm font-semibold tracking-tight text-foreground">
                {t("serviceBlockTitle", { index: si + 1 })}
              </h2>
              <ChevronDown
                className={cn(
                  "size-5 shrink-0 text-muted-foreground transition-transform duration-300 ease-out",
                  open && "rotate-180",
                )}
                aria-hidden
              />
            </CollapsibleTrigger>
            <CollapsibleContent
              id={`service-panel-body-${si}`}
              role="region"
              aria-labelledby={`service-panel-heading-${si}`}
            >
              <div className="transform-gpu space-y-4 border-t border-border/30 p-4">
                <div className="space-y-1.5">
                  <span className="text-sm font-medium text-foreground">
                    {t("servicesMajorSphereLabel")}
                  </span>
                  <Select
                    value={rowMajorResolved}
                    disabled={servicesSubmitting}
                    onValueChange={(nextSlug) => {
                      const firstCat = categories.find(
                        (c) => c.majorSlug === nextSlug,
                      );
                      if (!firstCat) {
                        return;
                      }
                      updateSvc(si, {
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
                  value={s}
                  disabled={servicesSubmitting}
                  categoryLabelVariant="prominent"
                  bodyZoneOptions={bodyZoneOptions}
                  onChange={(next) => updateSvc(si, next)}
                />
                {services.length > 1 ?
                  <>
                    <Separator className="bg-border/50" />
                    <div className="pt-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto w-full py-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={servicesSubmitting}
                        onClick={() => removeService(si)}
                      >
                        {t("removeService")}
                      </Button>
                    </div>
                  </>
                : null}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}

      <Button
        type="button"
        variant="primary"
        className="h-12 w-full gap-2 rounded-2xl border-2 border-primary !bg-transparent text-primary shadow-none hover:!bg-transparent hover:border-primary hover:text-primary active:!bg-transparent active:opacity-90"
        onClick={addService}
        disabled={servicesSubmitting || categories.length < 1}
      >
        <Plus className="size-4 shrink-0" aria-hidden />
        {t("addService")}
      </Button>
    </section>
  );
}
