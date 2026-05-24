"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Tags } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { PriceRangeSlider } from "@/shared/ui/price-range-slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/shadcn/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/shadcn/empty";
import { cn } from "@/shared/lib";
import { BodyZonesSelector, type BodyZoneOption } from "@/entities/body-zones";
import {
  CatalogFilterCheckboxRow,
  CatalogFilterRadioRow,
  CatalogFilterSection,
} from "./catalog-filter-layout";
import { CatalogSlotTimeFilter } from "./catalog-slot-time-filter";


export type CatalogFilterCategoryOption = {
  slug: string;
  shortName: string;
};

export type CatalogFiltersPriceConfig = {
  extent: { min: number; max: number };
  value: [number, number];
  step: number;
  onValueChange: (value: [number, number]) => void;
  formatValue: (n: number) => string;
};

export type CatalogSlotTimeFilterValue = {
  day: string;
  time: string;
};

export type CatalogFiltersProps = {
  onApplyFilters?: () => void;
  /** Показать кнопку «Готово» (ручное применение). По умолчанию фильтры применяются сразу. */
  showApplyButton?: boolean;
  /** Показать «Сбросить» рядом с заголовком. */
  showResetButton?: boolean;
  onResetFilters: () => void;
  selectedCategorySlugs: string[];
  onToggleCategory: (slug: string) => void;
  categoryOptions: CatalogFilterCategoryOption[];
  bodyZoneOptions?: BodyZoneOption[];
  selectedBodyZoneSlugs?: string[];
  onChangeBodyZoneSlugs?: (slugs: string[]) => void;
  genderOptions?: Array<"male" | "female">;
  selectedGender?: "male" | "female" | null;
  onSelectGender?: (gender: "male" | "female" | null) => void;
  priceFilter: CatalogFiltersPriceConfig | null;
  /**
   * Фильтр «свободный слот в этот день/время» (поиск). Пустые строки — «не задано».
   */
  slotTimeFilter?: {
    value: CatalogSlotTimeFilterValue;
    onChange: (next: CatalogSlotTimeFilterValue) => void;
    timeOptions: { value: string; label: string }[];
  } | null;
  /**
   * API вернул специалистов, но нет VND-цен в `bookableServices` — подсказка вместо слайдера.
   */
  showPriceDataUnavailable?: boolean;
  /**
   * Диапазон VND из каталога (например салоны) без слайдера: только справка.
   */
  readOnlyVndLine?: { min: string; max: string } | null;
  showReadOnlyVndNote?: boolean;
  /**
   * Поиск по радиусу: переход на карту для настройки; при активном — краткое пояснение (например дистанция).
   */
  radiusMapFilter?: {
    isActive: boolean;
    activeDetailLabel?: string;
    onSelectOnMap: () => void;
  } | null;
  /** `panel` — inline-карточка (desktop sidebar); `dialog` — модальное окно (mobile). */
  presentation?: "panel" | "dialog";
  /** Для `presentation="dialog"`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
};

function CatalogFiltersHeader({
  presentation,
  showResetButton,
  onResetFilters,
}: {
  presentation: "panel" | "dialog";
  showResetButton: boolean;
  onResetFilters: () => void;
}) {
  const t = useTranslations("catalogFilters");
  const titleClassName =
    "text-lg font-semibold leading-none tracking-tight text-foreground";

  return (
    <div
      className={cn(
        "flex h-10 shrink-0 items-center justify-between gap-3",
        presentation === "dialog" && "px-5",
      )}
    >
      <div className="min-w-0">
        {presentation === "dialog" ?
          <DialogTitle className={titleClassName}>{t("title")}</DialogTitle>
        : <h2 className={titleClassName}>{t("title")}</h2>}
        <p className="sr-only">{t("description")}</p>
      </div>
      <div className="flex h-8 shrink-0 items-center justify-end">
        {showResetButton ? (
          <Button
            type="button"
            variant="ghost"
            className="h-8 px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            onClick={onResetFilters}
          >
            {t("reset")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function CatalogFilters({
  onApplyFilters,
  showApplyButton = false,
  showResetButton = false,
  onResetFilters,
  selectedCategorySlugs,
  onToggleCategory,
  categoryOptions,
  bodyZoneOptions = [],
  selectedBodyZoneSlugs = [],
  onChangeBodyZoneSlugs,
  genderOptions = [],
  selectedGender = null,
  onSelectGender,
  priceFilter,
  showPriceDataUnavailable = false,
  readOnlyVndLine = null,
  showReadOnlyVndNote = false,
  slotTimeFilter = null,
  radiusMapFilter = null,
  presentation = "panel",
  open = false,
  onOpenChange,
  className,
}: CatalogFiltersProps) {
  const t = useTranslations("catalogFilters");
  const priceHeadingId = useId();
  const genderGroupName = useId();
  const categoryFieldId = useId();
  const selected = new Set(selectedCategorySlugs);
  const isDialog = presentation === "dialog";

  const panel = (
    <div
      className={cn(
        "flex flex-col",
        isDialog ?
          "min-h-0 flex-1"
        : "box-border w-full gap-5 rounded-2xl border border-border/45 bg-card p-5",
        className,
      )}
    >
      {isDialog ?
        <DialogHeader className="shrink-0 gap-1 pt-6 pb-1">
          <CatalogFiltersHeader
            presentation={presentation}
            showResetButton={showResetButton}
            onResetFilters={onResetFilters}
          />
          <DialogDescription className="sr-only">
            {t("description")}
          </DialogDescription>
        </DialogHeader>
      : <CatalogFiltersHeader
          presentation={presentation}
          showResetButton={showResetButton}
          onResetFilters={onResetFilters}
        />
      }
      <div
        className={cn(
          "flex flex-col gap-5",
          isDialog &&
            "min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-5 pb-5 [-webkit-overflow-scrolling:touch]",
        )}
      >
        {priceFilter ? (
          <CatalogFilterSection
            title={t("price")}
            headingId={priceHeadingId}
          >
            <PriceRangeSlider
              min={priceFilter.extent.min}
              max={priceFilter.extent.max}
              step={priceFilter.step}
              value={priceFilter.value}
              onValueChange={priceFilter.onValueChange}
              formatValue={priceFilter.formatValue}
              aria-labelledby={priceHeadingId}
            />
          </CatalogFilterSection>
        ) : readOnlyVndLine ? (
          <CatalogFilterSection
            title={t("price")}
            headingId={priceHeadingId}
          >
            <div className="space-y-2 text-sm text-foreground">
              <p className="font-medium leading-relaxed">
                {t("priceReadOnlyVnd", {
                  min: readOnlyVndLine.min,
                  max: readOnlyVndLine.max,
                })}
              </p>
              {showReadOnlyVndNote ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("priceReadOnlyNote")}
                </p>
              ) : null}
            </div>
          </CatalogFilterSection>
        ) : showPriceDataUnavailable ? (
          <CatalogFilterSection
            title={t("price")}
            headingId={priceHeadingId}
          >
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("priceNoData")}
            </p>
          </CatalogFilterSection>
        ) : null}
        {slotTimeFilter ? (
          <CatalogFilterSection title={t("slotTimeHeading")}>
            <CatalogSlotTimeFilter
              value={slotTimeFilter.value}
              onChange={slotTimeFilter.onChange}
              timeOptions={slotTimeFilter.timeOptions}
            />
          </CatalogFilterSection>
        ) : null}
        {radiusMapFilter ? (
          <CatalogFilterSection title={t("radiusHeading")}>
            <Button
              type="button"
              variant="secondary"
              tone="light"
              className="h-11 w-full rounded-lg border-0 bg-muted/60 text-sm font-medium shadow-none hover:bg-muted"
              onClick={radiusMapFilter.onSelectOnMap}
            >
              {radiusMapFilter.isActive ?
                (radiusMapFilter.activeDetailLabel ?
                  `${t("radiusButtonActive")}: ${radiusMapFilter.activeDetailLabel}`
                : t("radiusButtonActive"))
              : t("radiusSelectOnMap")}
            </Button>
          </CatalogFilterSection>
        ) : null}
        <CatalogFilterSection title={t("category")}>
          {categoryOptions.length === 0 ? (
            <Empty className="py-4">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Tags aria-hidden />
                </EmptyMedia>
                <EmptyTitle className="text-muted-foreground">
                  {t("noCategories")}
                </EmptyTitle>
                <EmptyDescription className="max-w-xs text-xs">
                  {t("noCategoriesHint")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div role="group" aria-label={t("category")} className="space-y-0.5">
              {categoryOptions.map(({ slug, shortName }) => (
                <CatalogFilterCheckboxRow
                  key={slug}
                  id={`${categoryFieldId}-${slug}`}
                  label={shortName}
                  checked={selected.has(slug)}
                  onCheckedChange={() => {
                    onToggleCategory(slug);
                  }}
                />
              ))}
            </div>
          )}
        </CatalogFilterSection>
        {bodyZoneOptions.length > 0 && onChangeBodyZoneSlugs ? (
          <CatalogFilterSection title={t("bodyZones")}>
            <BodyZonesSelector
              zones={bodyZoneOptions}
              selectedSlugs={selectedBodyZoneSlugs}
              onChangeSelectedSlugs={onChangeBodyZoneSlugs}
              compact
            />
          </CatalogFilterSection>
        ) : null}
        {genderOptions.length > 0 && onSelectGender ? (
          <CatalogFilterSection title={t("gender")}>
            <div role="radiogroup" aria-label={t("gender")} className="space-y-0.5">
              <CatalogFilterRadioRow
                id={`${genderGroupName}-any`}
                name={genderGroupName}
                label={t("genderAny")}
                checked={selectedGender == null}
                onSelect={() => onSelectGender(null)}
              />
              {genderOptions.map((g) => (
                <CatalogFilterRadioRow
                  key={g}
                  id={`${genderGroupName}-${g}`}
                  name={genderGroupName}
                  label={g === "male" ? t("genderMale") : t("genderFemale")}
                  checked={selectedGender === g}
                  onSelect={() => onSelectGender(g)}
                />
              ))}
            </div>
          </CatalogFilterSection>
        ) : null}
      </div>
      {showApplyButton ? (
        <div className="mt-0 shrink-0 rounded-b-2xl border-t border-border/35 bg-card px-5 py-4">
          <Button
            type="button"
            className="h-11 w-full rounded-full font-medium shadow-sm"
            onClick={() => {
              onApplyFilters?.();
            }}
          >
            {t("done")}
          </Button>
        </div>
      ) : null}
    </div>
  );

  if (isDialog) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "!flex max-h-[85dvh] min-h-0 !flex-col gap-0 overflow-hidden p-0 sm:max-w-sm",
            "rounded-2xl border border-border/45 bg-card text-foreground",
          )}
          showCloseButton
        >
          {panel}
        </DialogContent>
      </Dialog>
    );
  }

  return panel;
}
