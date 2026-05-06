"use client";

import { useLayoutEffect } from "react";
import { useLocale } from "next-intl";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ChevronDown, Plus, Sparkles } from "lucide-react";
import {
  SpecialistPersonalServiceFields,
} from "@/entities/specialists";
import { defaultBodyZoneSlugsForCategorySlug } from "@/entities/body-zones";
import { cn } from "@/shared/lib";
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Separator,
} from "@/shared/ui";
import { defaultSvc } from "../../lib/specialist-onboarding-utils";
import { useSpecialistOnboardingCatalogCategories } from "../../lib/use-specialist-onboarding-catalog-categories";
import { useSpecialistOnboarding } from "../specialist-onboarding-context";
import { createBrowserSdkClient, directoryGetCatalogFilterOptions } from "@/shared/api";
import type { AppLocale } from "@/app/i18n/routing";

export default function SpecialistOnboardingStepServices() {
  const t = useTranslations("specialistOnboarding");
  const locale = useLocale() as AppLocale;
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? "";
  const { data: categories = [], isLoading } =
    useSpecialistOnboardingCatalogCategories(true);
  const {
    services,
    setServices,
    servicesSubmitting,
    addService,
    removeService,
    updateSvc,
    isServicePanelOpen,
    setServicePanelOpen,
  } = useSpecialistOnboarding();
  const bodyZonesQuery = useQuery({
    queryKey: ["onboardingBodyZones", locale, accessToken],
    enabled: accessToken.length > 0,
    queryFn: async () => {
      const { data, error } = await directoryGetCatalogFilterOptions({
        client: createBrowserSdkClient(accessToken, { locale }),
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
    if (!categories.length) {
      return;
    }
    setServices((prev) =>
      prev.length > 0 ?
        prev
      : [
          {
            ...defaultSvc(categories[0]!.id),
            bodyZoneSlugs: defaultBodyZoneSlugsForCategorySlug(categories[0]!.slug),
          },
        ],
    );
  }, [categories, setServices]);

  if (isLoading || !categories.length) {
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
              {t("step3Title")}
            </h1>
            <p className="text-pretty text-[0.9375rem] leading-relaxed text-muted-foreground">
              {t("step3Sub")}
            </p>
          </div>
        </div>
      </div>

      {services.map((s, si) => {
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
                <SpecialistPersonalServiceFields
                  categories={categories}
                  value={s}
                  disabled={servicesSubmitting}
                  categoryLabelVariant="prominent"
                  bodyZoneOptions={bodyZoneOptions}
                  onChange={(next) => updateSvc(si, next)}
                />
                {services.length > 1 ? (
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
                ) : null}
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
        disabled={servicesSubmitting}
      >
        <Plus className="size-4 shrink-0" aria-hidden />
        {t("addService")}
      </Button>
    </section>
  );
}
