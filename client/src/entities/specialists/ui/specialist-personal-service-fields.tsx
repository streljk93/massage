"use client";

import { useEffect, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/shared/lib";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui";
import {
  BodyZonesSelector,
  defaultBodyZoneSlugsForCategorySlugs,
  getAllowedBodyZoneSlugsForCategorySlugs,
  normalizeBodyZoneSlugsForCategories,
  type BodyZoneOption,
} from "@/entities/body-zones";
import {
  DURATION_MINUTES_MAX,
  DURATION_MINUTES_MIN,
  digitsFromVndPriceInput,
  formatVndPriceForInput,
  nextMinutesWhenAddingDuration,
  type Cat,
  type SvcForm,
} from "../lib/personal-service-catalog-draft";

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((v, i) => v === b[i]);
}

export type SpecialistPersonalServiceFieldsProps = {
  categories: Cat[];
  value: SvcForm;
  onChange: (next: SvcForm) => void;
  disabled?: boolean;
  bodyZoneOptions?: BodyZoneOption[];
  /**
   * Подпись категории: как на шаге 3 онбординга (`prominent`) или как в кабинете (`compact`).
   */
  categoryLabelVariant?: "prominent" | "compact";
};

/**
 * Общие поля одной личной услуги: категория, длительности и цены.
 * Используется на шаге 3 онбординга и на экранах создания/редактирования услуги в ЛК.
 */
export function SpecialistPersonalServiceFields({
  categories,
  value,
  onChange,
  disabled = false,
  bodyZoneOptions = [],
  categoryLabelVariant = "prominent",
}: SpecialistPersonalServiceFieldsProps) {
  const tOnb = useTranslations("specialistOnboarding");
  const selectedCategorySlug = categories.find((c) => c.id === value.categoryId)?.slug ?? null;
  const comboCategorySlugs = useMemo(
    () =>
      categories
        .filter((c) => value.comboCategoryIds.includes(c.id))
        .map((c) => c.slug),
    [categories, value.comboCategoryIds],
  );
  const activeCategorySlugs = useMemo(
    () =>
      value.kind === "combo" ?
        [selectedCategorySlug, ...comboCategorySlugs]
      : [selectedCategorySlug],
    [comboCategorySlugs, selectedCategorySlug, value.kind],
  );
  const allowedBodyZoneSlugs = useMemo(
    () => getAllowedBodyZoneSlugsForCategorySlugs(activeCategorySlugs),
    [activeCategorySlugs],
  );
  const allowedBodyZoneSlugSet = useMemo(
    () => new Set(allowedBodyZoneSlugs),
    [allowedBodyZoneSlugs],
  );
  const allowedBodyZoneOptions = useMemo(
    () => bodyZoneOptions.filter((z) => allowedBodyZoneSlugSet.has(z.slug)),
    [bodyZoneOptions, allowedBodyZoneSlugSet],
  );

  useEffect(() => {
    const normalized = normalizeBodyZoneSlugsForCategories({
      selectedSlugs: value.bodyZoneSlugs,
      categorySlugs: activeCategorySlugs,
    });
    if (!arraysEqual(normalized, value.bodyZoneSlugs)) {
      onChange({ ...value, bodyZoneSlugs: normalized });
    }
  }, [activeCategorySlugs, onChange, value]);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <span
          className={cn(
            categoryLabelVariant === "compact" ?
              "text-[0.625rem] font-semibold tracking-[0.05em] text-muted-foreground uppercase"
            : "text-sm font-medium text-foreground",
          )}
        >
          {tOnb("categoryLabel")}
        </span>
        <Select
          value={value.categoryId}
          disabled={disabled}
          onValueChange={(v) => {
            const nextCategorySlug = categories.find((c) => c.id === v)?.slug ?? null;
            const nextBodyZoneSlugs =
              defaultBodyZoneSlugsForCategorySlugs(
                value.kind === "combo" ?
                  [
                    nextCategorySlug,
                    ...categories
                      .filter((c) => value.comboCategoryIds.includes(c.id))
                      .map((c) => c.slug),
                  ]
                : [nextCategorySlug],
              );
            onChange({ ...value, categoryId: v, bodyZoneSlugs: nextBodyZoneSlugs });
          }}
        >
          <SelectTrigger className="h-12 w-full min-w-0 rounded-2xl border-0 bg-muted/45">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-[min(70vh,28rem)]">
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span className="flex flex-col gap-1 py-0.5">
                  <span className="font-medium text-foreground">{c.name}</span>
                  {c.shortName.trim().length > 0 && c.shortName.trim() !== c.name.trim() ?
                    <span className="text-xs font-normal text-muted-foreground">{c.shortName}</span>
                  : null}
                  {c.description?.trim() ?
                    <span className="text-xs font-normal leading-snug text-muted-foreground line-clamp-4">
                      {c.description.trim()}
                    </span>
                  : null}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <span className="text-sm font-medium text-foreground">{tOnb("serviceKind")}</span>
        <div className="flex gap-2">
          {(["standard", "combo"] as const).map((k) => {
            const selected = value.kind === k;
            return (
              <button
                key={k}
                type="button"
                disabled={disabled}
                onClick={() =>
                  onChange({
                    ...value,
                    kind: k,
                    comboCategoryIds: k === "combo" ? value.comboCategoryIds : [],
                    bodyZoneSlugs:
                      k === "combo" ?
                        defaultBodyZoneSlugsForCategorySlugs([
                          selectedCategorySlug,
                          ...comboCategorySlugs,
                        ])
                      : defaultBodyZoneSlugsForCategorySlugs([selectedCategorySlug]),
                  })
                }
                className={cn(
                  "rounded-full border px-3.5 py-2 text-sm disabled:opacity-60",
                  selected
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-muted/20",
                )}
              >
                {k === "combo" ? tOnb("serviceKindCombo") : tOnb("serviceKindStandard")}
              </button>
            );
          })}
        </div>
      </div>
      {value.kind === "combo" ? (
        <div className="space-y-2">
          <span className="text-sm font-medium text-foreground">{tOnb("comboIncludes")}</span>
          <div className="flex flex-wrap gap-2 rounded-xl border border-border/30 bg-muted/20 p-2.5">
            {categories
              .filter((c) => c.id !== value.categoryId)
              .map((c) => {
                const selected = value.comboCategoryIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      const next = selected
                        ? value.comboCategoryIds.filter((id) => id !== c.id)
                        : [...value.comboCategoryIds, c.id];
                      const nextComboCategorySlugs = categories
                        .filter((cat) => next.includes(cat.id))
                        .map((cat) => cat.slug);
                      onChange({
                        ...value,
                        comboCategoryIds: next,
                        bodyZoneSlugs: defaultBodyZoneSlugsForCategorySlugs([
                          selectedCategorySlug,
                          ...nextComboCategorySlugs,
                        ]),
                      });
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs disabled:opacity-60",
                      selected
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-border/55 bg-card text-foreground",
                    )}
                  >
                    {c.shortName || c.name}
                  </button>
                );
              })}
          </div>
        </div>
      ) : null}
      {allowedBodyZoneOptions.length > 0 ? (
        <BodyZonesSelector
          zones={allowedBodyZoneOptions}
          selectedSlugs={value.bodyZoneSlugs}
          onChangeSelectedSlugs={(next) => {
            onChange({ ...value, bodyZoneSlugs: next });
          }}
          disabled={disabled}
        />
      ) : null}

      <p className="text-xs leading-relaxed text-muted-foreground">{tOnb("addDurationHint")}</p>

      <div className="space-y-2">
        {value.durationPrices.map((dp, di) => (
          <div
            key={`dp-${di}`}
            className="grid min-w-0 grid-cols-[minmax(0,5.25rem)_1fr_2.75rem] items-stretch gap-2 rounded-2xl bg-muted/20 p-3 ring-1 ring-inset ring-border/25"
          >
            <div className="min-w-0 space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">{tOnb("duration")}</span>
              <Input
                type="number"
                min={DURATION_MINUTES_MIN}
                max={DURATION_MINUTES_MAX}
                className="h-11 rounded-xl border-0 bg-background/80"
                disabled={disabled}
                value={dp.minutes > 0 ? String(dp.minutes) : ""}
                onChange={(e) => {
                  const nextD = [...value.durationPrices];
                  const raw = e.target.value;
                  if (raw === "") {
                    nextD[di] = { ...nextD[di]!, minutes: 0 };
                    onChange({ ...value, durationPrices: nextD });
                    return;
                  }
                  const m = parseInt(raw, 10);
                  if (Number.isNaN(m) || m < 0) {
                    return;
                  }
                  nextD[di] = { ...nextD[di]!, minutes: m };
                  onChange({ ...value, durationPrices: nextD });
                }}
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">{tOnb("priceVnd")}</span>
              <Input
                type="text"
                className="h-11 min-w-0 rounded-xl border-0 bg-background/80"
                value={formatVndPriceForInput(dp.priceVnd)}
                disabled={disabled}
                onChange={(e) => {
                  const digitsOnly = digitsFromVndPriceInput(e.target.value);
                  const nextD = [...value.durationPrices];
                  nextD[di] = { ...nextD[di]!, priceVnd: digitsOnly };
                  onChange({ ...value, durationPrices: nextD });
                }}
                inputMode="numeric"
                autoComplete="off"
                placeholder="—"
              />
            </div>
            <div className="flex min-h-0 min-w-0 items-end justify-end self-stretch">
              {di > 0 ?
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 w-11 shrink-0 rounded-xl border-0 bg-muted/45 p-0 text-muted-foreground shadow-none hover:bg-muted/50 hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring/35"
                  disabled={disabled}
                  aria-label={tOnb("removeDuration")}
                  onClick={() => {
                    const nextD = value.durationPrices.filter((_, j) => j !== di);
                    if (nextD.length < 1) {
                      return;
                    }
                    onChange({ ...value, durationPrices: nextD });
                  }}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              : null}
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="ghost"
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-0 bg-muted/45 px-3 text-sm font-medium text-muted-foreground shadow-none hover:bg-muted/50 hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring/35"
        disabled={disabled}
        onClick={() => {
          const next = [
            ...value.durationPrices,
            {
              minutes: nextMinutesWhenAddingDuration(value.durationPrices),
              priceVnd: "",
            },
          ];
          onChange({ ...value, durationPrices: next });
        }}
      >
        <Plus className="size-4 shrink-0" aria-hidden />
        {tOnb("addDuration")}
      </Button>
    </div>
  );
}
