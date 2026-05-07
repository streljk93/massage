"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/shared/lib";
import {
  useSpecialistOnboarding,
  type SpecialistWorkPatternUi,
} from "../specialist-onboarding-context";

const ORDER: SpecialistWorkPatternUi[] = ["solo", "business", "employed_salon"];

export default function SpecialistOnboardingStepWorkPattern() {
  const t = useTranslations("specialistOnboarding");
  const { draftWorkPattern, setDraftWorkPattern } = useSpecialistOnboarding();

  return (
    <section className="space-y-3">
      <h1 className="font-heading text-2xl font-semibold text-foreground">
        {t("stepWorkPatternTitle")}
      </h1>
      <p className="text-pretty text-[0.9375rem] text-muted-foreground">
        {t("stepWorkPatternSub")}
      </p>

      <div
        role="radiogroup"
        aria-labelledby="work-pattern-legend"
        className="space-y-2"
      >
        <span id="work-pattern-legend" className="sr-only">
          {t("stepWorkPatternTitle")}
        </span>
        {ORDER.map((opt) => {
          const selected = draftWorkPattern === opt;
          const titleKey =
            opt === "solo" ? "workPatternOptionSolo"
            : opt === "business" ? "workPatternOptionBusiness"
            : "workPatternOptionEmployed";
          const hintKey =
            opt === "solo" ? "workPatternHintSolo"
            : opt === "business" ? "workPatternHintBusiness"
            : "workPatternHintEmployed";
          return (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setDraftWorkPattern(opt)}
              className={cn(
                "flex w-full flex-col rounded-2xl border px-4 py-3 text-start transition-colors",
                selected ?
                  "border-primary bg-primary/5 ring-2 ring-primary/30"
                : "border-border bg-muted/20 hover:bg-muted/40",
              )}
            >
              <span className="text-sm font-semibold text-foreground">
                {t(titleKey)}
              </span>
              <span className="text-pretty text-xs text-muted-foreground">
                {t(hintKey)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
