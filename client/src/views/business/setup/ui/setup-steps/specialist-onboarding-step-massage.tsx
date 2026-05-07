"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { defaultWizardStepForApiStep } from "@/entities/business";
import { cn } from "@/shared/lib";
import { Checkbox } from "@/shared/ui";
import { useSpecialistOnboarding } from "../specialist-onboarding-context";

export default function SpecialistOnboardingStepMassage() {
  const t = useTranslations("specialistOnboarding");
  const { apiStep, setStep, massageSaving, strength, setStrength, adapt, setAdapt } =
    useSpecialistOnboarding();

  useEffect(() => {
    if (apiStep !== 5) {
      setStep(defaultWizardStepForApiStep(apiStep), apiStep);
    }
  }, [apiStep, setStep]);

  return (
    <section className="space-y-3">
      <h1 className="font-heading text-2xl font-semibold text-foreground">
        {t("stepMassageTitle")}
      </h1>
      <p className="text-pretty text-[0.9375rem] text-muted-foreground">
        {t("stepMassageSub")}
      </p>

      <div className="space-y-3 rounded-2xl bg-muted/20 p-4 ring-1 ring-inset ring-border/40">
        <span className="text-sm font-medium text-foreground">{t("strengthLabel")}</span>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="max-w-[40%] leading-snug">{t("strengthLeft")}</span>
          <span className="max-w-[40%] text-right leading-snug">{t("strengthRight")}</span>
        </div>
        <div
          className={cn("flex gap-1.5 transition-opacity", adapt && "opacity-45")}
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
                disabled={massageSaving || adapt}
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
            disabled={massageSaving}
            checked={adapt}
            onCheckedChange={(c) => setAdapt(c === true)}
          />
          <span className="text-pretty text-sm leading-snug text-foreground">
            {t("adaptCheck")}
          </span>
        </label>
      </div>
    </section>
  );
}
