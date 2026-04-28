"use client";

import { useTranslations } from "next-intl";

export default function SpecialistOnboardingStepIntro() {
  const t = useTranslations("specialistOnboarding");
  return (
    <section className="space-y-3">
      <h1 className="font-heading text-2xl font-semibold text-foreground">
        {t("step1Title")}
      </h1>
      <p className="text-pretty text-[0.9375rem] text-muted-foreground">
        {t("step1Sub")}
      </p>
    </section>
  );
}
