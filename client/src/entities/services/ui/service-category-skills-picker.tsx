"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/shared/lib";
import { Checkbox } from "@/shared/ui";
import type { ServiceCategorySkillsPickerProps } from "../model/service-category-skills-picker.types";

export type { ServiceCategorySkillsPickerProps } from "../model/service-category-skills-picker.types";

export function ServiceCategorySkillsPicker({
  sections,
  selectedIds,
  onToggle,
  disabled,
  groupAriaLabel,
  optionAriaLabel,
}: ServiceCategorySkillsPickerProps) {
  const t = useTranslations("serviceCategorySkillsPicker");

  return (
    <div className="space-y-8">
      {sections.map((sec) => (
        <section
          key={sec.majorSlug}
          className="space-y-3"
          aria-label={groupAriaLabel(sec.majorName)}
        >
          <h2 className="text-sm font-semibold text-foreground">
            {sec.majorName}
          </h2>
          <ul className="space-y-2">
            {sec.items.map((item) => {
              const on = selectedIds.has(item.categoryId);
              return (
                <li key={item.categoryId}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors",
                      disabled && "pointer-events-none opacity-60",
                      on ? "border-primary bg-primary/5" : (
                        "border-border bg-muted/20 hover:bg-muted/40"
                      ),
                    )}
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={on}
                      disabled={disabled}
                      onCheckedChange={() => {
                        onToggle(item.categoryId);
                      }}
                      aria-label={optionAriaLabel(item.name)}
                    />
                    <span className="text-pretty text-sm font-medium text-foreground">
                      {item.name}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {sections.length === 0 ?
        <p className="text-sm text-muted-foreground">{t("emptySections")}</p>
      : null}
    </div>
  );
}
