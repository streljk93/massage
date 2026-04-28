"use client";

import { useLayoutEffect } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Plus, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/shared/lib";
import {
  Button,
  Checkbox,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from "@/shared/ui";
import {
  defaultSvc,
  DURATION_MINUTES_MAX,
  DURATION_MINUTES_MIN,
  digitsFromVndPriceInput,
  formatVndPriceForInput,
  nextMinutesWhenAddingDuration,
} from "../../lib/specialist-onboarding-utils";
import { useSpecialistOnboardingCatalogCategories } from "../../lib/use-specialist-onboarding-catalog-categories";
import { useSpecialistOnboarding } from "../specialist-onboarding-context";

export default function SpecialistOnboardingStepServices() {
  const t = useTranslations("specialistOnboarding");
  const { data: categories = [], isLoading } =
    useSpecialistOnboardingCatalogCategories(true);
  const {
    services,
    setServices,
    servicesSubmitting,
    strength,
    setStrength,
    adapt,
    setAdapt,
    addService,
    removeService,
    updateSvc,
    isServicePanelOpen,
    setServicePanelOpen,
  } = useSpecialistOnboarding();

  useLayoutEffect(() => {
    if (!categories.length) {
      return;
    }
    setServices((prev) =>
      prev.length > 0 ? prev : [defaultSvc(categories[0]!.id)],
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

      <div className="space-y-3 rounded-2xl bg-muted/20 p-4 ring-1 ring-inset ring-border/40">
        <span className="text-sm font-medium text-foreground">{t("strengthLabel")}</span>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="max-w-[40%] leading-snug">{t("strengthLeft")}</span>
          <span className="max-w-[40%] text-right leading-snug">{t("strengthRight")}</span>
        </div>
        <div
          className={cn(
            "flex gap-1.5 transition-opacity",
            adapt && "opacity-45",
          )}
          role="group"
          aria-label={t("strengthLabel")}
        >
          {[1, 2, 3, 4, 5].map((d) => {
            const on = d <= strength;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setStrength(d)}
                disabled={servicesSubmitting || adapt}
                className={cn(
                  "box-border flex h-12 min-h-12 min-w-0 flex-1 touch-target items-center justify-center rounded-xl border-2 text-sm font-semibold tabular-nums transition-colors duration-150 disabled:opacity-50",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/60 bg-background/90 text-foreground/55 hover:border-primary/30 hover:bg-muted/40",
                )}
                aria-pressed={on}
                aria-label={`${d} / 5`}
              >
                {d}
              </button>
            );
          })}
        </div>
        <label
          className={cn(
            "mt-1 flex cursor-pointer items-start gap-3 border-t border-border/30 pt-3",
            "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-primary/30",
          )}
        >
          <Checkbox
            className="mt-0.5"
            disabled={servicesSubmitting}
            checked={adapt}
            onCheckedChange={(c) => setAdapt(c === true)}
          />
          <span className="text-pretty text-sm leading-snug text-foreground">
            {t("adaptCheck")}
          </span>
        </label>
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
                <div className="space-y-1.5">
                  <span className="text-sm font-medium text-foreground">
                    {t("categoryLabel")}
                  </span>
                  <Select
                    value={s.categoryId}
                    disabled={servicesSubmitting}
                    onValueChange={(v) => updateSvc(si, { ...s, categoryId: v })}
                  >
                    <SelectTrigger className="h-12 w-full min-w-0 rounded-2xl border-0 bg-muted/45">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("addDurationHint")}
                </p>
                <div className="space-y-2">
                  {s.durationPrices.map((dp, di) => (
                    <div
                      key={`${si}-${di}`}
                      className="grid min-w-0 grid-cols-[minmax(0,5.25rem)_1fr_2.75rem] items-stretch gap-2 rounded-2xl bg-muted/20 p-3 ring-1 ring-inset ring-border/25"
                    >
                      <div className="min-w-0 space-y-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                          {t("duration")}
                        </span>
                        <Input
                          type="number"
                          min={DURATION_MINUTES_MIN}
                          max={DURATION_MINUTES_MAX}
                          className="h-11 rounded-xl border-0 bg-background/80"
                          disabled={servicesSubmitting}
                          value={dp.minutes > 0 ? String(dp.minutes) : ""}
                          onChange={(e) => {
                            const nextD = [...s.durationPrices];
                            const raw = e.target.value;
                            if (raw === "") {
                              nextD[di] = { ...nextD[di]!, minutes: 0 };
                              updateSvc(si, { ...s, durationPrices: nextD });
                              return;
                            }
                            const m = parseInt(raw, 10);
                            if (Number.isNaN(m) || m < 0) {
                              return;
                            }
                            nextD[di] = { ...nextD[di]!, minutes: m };
                            updateSvc(si, { ...s, durationPrices: nextD });
                          }}
                        />
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                          {t("priceVnd")}
                        </span>
                        <Input
                          type="text"
                          className="h-11 min-w-0 rounded-xl border-0 bg-background/80"
                          value={formatVndPriceForInput(dp.priceVnd)}
                          disabled={servicesSubmitting}
                          onChange={(e) => {
                            const digitsOnly = digitsFromVndPriceInput(e.target.value);
                            const nextD = [...s.durationPrices];
                            nextD[di] = { ...nextD[di]!, priceVnd: digitsOnly };
                            updateSvc(si, { ...s, durationPrices: nextD });
                          }}
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="—"
                        />
                      </div>
                      <div className="flex min-h-0 min-w-0 items-end justify-end self-stretch">
                        {di > 0 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-11 w-11 shrink-0 rounded-xl border-0 bg-muted/45 p-0 text-muted-foreground shadow-none hover:bg-muted/50 hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring/35"
                            disabled={servicesSubmitting}
                            aria-label={t("removeDuration")}
                            onClick={() => {
                              const nextD = s.durationPrices.filter((_, j) => j !== di);
                              if (nextD.length < 1) {
                                return;
                              }
                              updateSvc(si, { ...s, durationPrices: nextD });
                            }}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-0 bg-muted/45 px-3 text-sm font-medium text-muted-foreground shadow-none hover:bg-muted/50 hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring/35 sm:w-auto"
                  disabled={servicesSubmitting}
                  onClick={() => {
                    const next = [
                      ...s.durationPrices,
                      {
                        minutes: nextMinutesWhenAddingDuration(s.durationPrices),
                        priceVnd: "",
                      },
                    ];
                    updateSvc(si, { ...s, durationPrices: next });
                  }}
                >
                  <Plus className="size-4 shrink-0" aria-hidden />
                  {t("addDuration")}
                </Button>
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
