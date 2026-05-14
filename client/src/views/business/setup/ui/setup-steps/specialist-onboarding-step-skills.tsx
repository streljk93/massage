"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ServiceCategorySkillSection } from "@/entities/services";
import { ServiceCategorySkillsPicker } from "@/entities/services";
import { useSpecialistOnboardingCatalogCategories } from "../../lib/use-specialist-onboarding-catalog-categories";
import { useSpecialistOnboarding } from "../specialist-onboarding-context";

export default function SpecialistOnboardingStepSkills() {
  const t = useTranslations("specialistOnboarding");
  const catalogQuery = useSpecialistOnboardingCatalogCategories(true);
  const { isLoading } = catalogQuery;
  const catalog = catalogQuery.data;
  const {
    spec,
    draftSkillCategoryIds,
    setDraftSkillCategoryIds,
    skillsSubmitting,
  } = useSpecialistOnboarding();

  const workplaceMajorsEmpty =
    Array.isArray(spec?.activeWorkplaceMajorCategorySlugs) &&
    spec.activeWorkplaceMajorCategorySlugs.length === 0;

  const sections: ServiceCategorySkillSection[] = useMemo(() => {
    const majors = catalog?.majors ?? [];
    const categories = catalog?.categories ?? [];
    const majorNameBySlug = new Map(majors.map((m) => [m.slug, m.name]));
    const byMajor = new Map<
      string,
      Array<{ categoryId: string; name: string }>
    >();
    for (const c of categories) {
      const list = byMajor.get(c.majorSlug) ?? [];
      list.push({ categoryId: c.id, name: c.label });
      byMajor.set(c.majorSlug, list);
    }
    return [...byMajor.entries()].map(([majorSlug, items]) => ({
      majorSlug,
      majorName: majorNameBySlug.get(majorSlug) ?? majorSlug,
      items: [...items].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    }));
  }, [catalog?.categories, catalog?.majors]);

  function toggle(id: string) {
    setDraftSkillCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  if (workplaceMajorsEmpty) {
    return (
      <section className="space-y-3">
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          {t("stepSkillsWorkplaceMajorsEmptyTitle")}
        </h1>
        <p className="text-pretty text-[0.9375rem] text-muted-foreground">
          {t("stepSkillsWorkplaceMajorsEmptyHint")}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h1 className="font-heading text-2xl font-semibold text-foreground">
        {t("stepSkillsTitle")}
      </h1>
      <p className="text-pretty text-[0.9375rem] text-muted-foreground">
        {t("stepSkillsSub")}
      </p>
      <p className="text-pretty text-sm text-muted-foreground">
        {t("stepSkillsHint")}
      </p>
      {isLoading ?
        <p className="text-sm text-muted-foreground">{t("skillsLoading")}</p>
      : catalogQuery.isError ?
        <p className="text-sm text-destructive" role="alert">
          {t("skillsError")}
        </p>
      : <ServiceCategorySkillsPicker
          sections={sections}
          selectedIds={draftSkillCategoryIds}
          onToggle={toggle}
          disabled={skillsSubmitting}
          groupAriaLabel={(name) => t("stepSkillsGroupAria", { name })}
          optionAriaLabel={(name) => t("stepSkillsOptionAria", { name })}
        />
      }
    </section>
  );
}
