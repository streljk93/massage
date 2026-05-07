"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { catalogGetMajorCategories } from "@/shared/api";
import { cn } from "@/shared/lib";
import { Checkbox } from "@/shared/ui";
import { useSpecialistOnboarding } from "../specialist-onboarding-context";

export default function SpecialistOnboardingStepMajors() {
  const t = useTranslations("specialistOnboarding");
  const {
    sdk,
    locale,
    accessToken,
    ready,
    draftMajorSlugs,
    setDraftMajorSlugs,
  } = useSpecialistOnboarding();

  const majorsQuery = useQuery({
    queryKey: ["onboardingMajorCategories", locale, accessToken],
    enabled: ready && accessToken.length > 0,
    queryFn: async () => {
      const { data, error } = await catalogGetMajorCategories({
        client: sdk,
        query: { locale },
      });
      if (error || !data?.majorCategories) {
        throw new Error("majors");
      }
      return [...data.majorCategories].sort(
        (a, b) =>
          a.sortOrder - b.sortOrder ||
          a.slug.localeCompare(b.slug, undefined, { sensitivity: "base" }),
      );
    },
  });

  function toggle(slug: string) {
    setDraftMajorSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  return (
    <section className="space-y-3">
      <h1 className="font-heading text-2xl font-semibold text-foreground">
        {t("stepMajorsTitle")}
      </h1>
      <p className="text-pretty text-[0.9375rem] text-muted-foreground">
        {t("stepMajorsSub")}
      </p>

      {majorsQuery.isLoading ?
        <p className="text-sm text-muted-foreground">{t("majorsLoading")}</p>
      : majorsQuery.isError ?
        <p className="text-sm text-destructive" role="alert">
          {t("majorsError")}
        </p>
      : <ul className="space-y-2">
          {majorsQuery.data?.map((m) => {
            const on = draftMajorSlugs.includes(m.slug);
            return (
              <li key={m.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors",
                    on ? "border-primary bg-primary/5" : (
                      "border-border bg-muted/20 hover:bg-muted/40"
                    ),
                  )}
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={on}
                    onCheckedChange={() => toggle(m.slug)}
                    aria-labelledby={`maj-${m.id}-lbl`}
                  />
                  <span
                    id={`maj-${m.id}-lbl`}
                    className="text-pretty text-sm font-medium text-foreground"
                  >
                    {m.name}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      }
    </section>
  );
}
