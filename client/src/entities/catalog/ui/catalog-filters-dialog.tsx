"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/shadcn/dialog";
import { Button } from "@/shared/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui";
import { PriceRangeSlider } from "@/shared/ui/price-range-slider";
import { cn } from "@/shared/lib";

/** Radix Select не принимает `value=""` у пункта — в сторе фильтра остаётся `""`. */
const CATALOG_FILTERS_SLOT_ANY = "__cf_slotAny__";

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

type CatalogFiltersDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCategorySlugs: string[];
  onToggleCategory: (slug: string) => void;
  onResetFilters: () => void;
  categoryOptions: CatalogFilterCategoryOption[];
  priceFilter: CatalogFiltersPriceConfig | null;
  /**
   * Фильтр «свободный слот в этот день/время» (поиск). Пустые строки — «не задано».
   */
  slotTimeFilter?: {
    value: CatalogSlotTimeFilterValue;
    onChange: (next: CatalogSlotTimeFilterValue) => void;
    dayOptions: { value: string; label: string }[];
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
};

export function CatalogFiltersDialog({
  open,
  onOpenChange,
  selectedCategorySlugs,
  onToggleCategory,
  onResetFilters,
  categoryOptions,
  priceFilter,
  showPriceDataUnavailable = false,
  readOnlyVndLine = null,
  showReadOnlyVndNote = false,
  slotTimeFilter = null,
  radiusMapFilter = null,
}: CatalogFiltersDialogProps) {
  const t = useTranslations("catalogFilters");
  const priceHeadingId = useId();
  const slotDaySelectId = useId();
  const slotTimeSelectId = useId();
  const selected = new Set(selectedCategorySlugs);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "!flex max-h-[85dvh] min-h-0 !flex-col gap-0 overflow-hidden p-0 sm:max-w-sm",
          "border border-border/45 bg-white text-foreground",
          "rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.12)]",
        )}
        showCloseButton
      >
        <div className="shrink-0 px-5 pt-6 pb-1">
          <DialogHeader className="gap-1">
            <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">
              {t("title")}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t("description")}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        {priceFilter ? (
          <div className="border-b border-border/25 px-5 pb-4">
            <p
              id={priceHeadingId}
              className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
              {t("price")}
            </p>
            <div className="rounded-xl border border-border/30 bg-white px-3 py-3.5">
              <PriceRangeSlider
                min={priceFilter.extent.min}
                max={priceFilter.extent.max}
                step={priceFilter.step}
                value={priceFilter.value}
                onValueChange={priceFilter.onValueChange}
                formatValue={priceFilter.formatValue}
                aria-labelledby={priceHeadingId}
              />
            </div>
          </div>
        ) : readOnlyVndLine ? (
          <div className="border-b border-border/25 px-5 pb-4">
            <p
              id={priceHeadingId}
              className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
              {t("price")}
            </p>
            <div className="space-y-2 rounded-xl border border-border/30 bg-white px-3 py-3.5 text-sm text-foreground">
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
          </div>
        ) : showPriceDataUnavailable ? (
          <div className="border-b border-border/25 px-5 pb-4">
            <p
              id={priceHeadingId}
              className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
              {t("price")}
            </p>
            <p className="rounded-xl border border-dashed border-border/45 bg-white px-3 py-3.5 text-sm leading-relaxed text-muted-foreground">
              {t("priceNoData")}
            </p>
          </div>
        ) : null}
        {slotTimeFilter ? (
          <div className="border-b border-border/25 px-5 pt-3 pb-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("slotTimeHeading")}
            </p>
            <div className="grid grid-cols-2 gap-x-2.5 gap-y-0">
              <div className="flex min-w-0 flex-col gap-1.5">
                <label
                  className="text-xs font-medium text-foreground/90"
                  htmlFor={slotDaySelectId}
                >
                  {t("slotDay")}
                </label>
                <Select
                  value={
                    slotTimeFilter.value.day === ""
                      ? CATALOG_FILTERS_SLOT_ANY
                      : slotTimeFilter.value.day
                  }
                  onValueChange={(v) => {
                    const day = v === CATALOG_FILTERS_SLOT_ANY ? "" : v;
                    slotTimeFilter.onChange({
                      day,
                      time: day ? slotTimeFilter.value.time : "",
                    });
                  }}
                >
                  <SelectTrigger
                    id={slotDaySelectId}
                    className={cn(
                      "h-10 w-full min-w-0 rounded-xl border-border/45 bg-white py-2 text-sm",
                      "text-foreground",
                    )}
                    size="sm"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" align="start">
                    <SelectItem value={CATALOG_FILTERS_SLOT_ANY}>
                      {t("slotAny")}
                    </SelectItem>
                    {slotTimeFilter.dayOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <label
                  className="text-xs font-medium text-foreground/90"
                  htmlFor={slotTimeSelectId}
                >
                  {t("slotTime")}
                </label>
                <Select
                  value={
                    slotTimeFilter.value.time === ""
                      ? CATALOG_FILTERS_SLOT_ANY
                      : slotTimeFilter.value.time
                  }
                  onValueChange={(v) => {
                    const time = v === CATALOG_FILTERS_SLOT_ANY ? "" : v;
                    slotTimeFilter.onChange({
                      day: time ? slotTimeFilter.value.day : "",
                      time,
                    });
                  }}
                >
                  <SelectTrigger
                    id={slotTimeSelectId}
                    className={cn(
                      "h-10 w-full min-w-0 rounded-xl border-border/45 bg-white py-2 text-sm",
                      "text-foreground",
                    )}
                    size="sm"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" align="start">
                    <SelectItem value={CATALOG_FILTERS_SLOT_ANY}>
                      {t("slotAny")}
                    </SelectItem>
                    {slotTimeFilter.timeOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ) : null}
        {radiusMapFilter ? (
          <div className="border-b border-border/25 px-5 py-3">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("radiusHeading")}
            </p>
            <Button
              type="button"
              variant="secondary"
              tone="light"
              className="h-11 w-full rounded-xl border border-border/50 bg-white text-sm font-medium shadow-none hover:bg-zinc-50/90"
              onClick={radiusMapFilter.onSelectOnMap}
            >
              {radiusMapFilter.isActive ?
                (radiusMapFilter.activeDetailLabel ?
                  `${t("radiusButtonActive")}: ${radiusMapFilter.activeDetailLabel}`
                : t("radiusButtonActive"))
              : t("radiusSelectOnMap")}
            </Button>
          </div>
        ) : null}
        <div className="px-5 pt-3 pb-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t("category")}
          </p>
          {categoryOptions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/45 bg-white px-3 py-4 text-center text-sm leading-relaxed text-muted-foreground">
              {t("noCategories")}
            </p>
          ) : (
            <div
              className="flex flex-wrap gap-2 rounded-xl border border-border/30 bg-white p-3"
              role="group"
              aria-label={t("category")}
            >
              {categoryOptions.map(({ slug, shortName }) => {
                const isSelected = selected.has(slug);
                return (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => {
                      onToggleCategory(slug);
                    }}
                    aria-pressed={isSelected}
                    className={cn(
                      "inline-flex h-9 min-h-9 max-w-full shrink-0 items-center justify-center rounded-full border px-3.5 text-left text-sm font-medium transition-[background-color,box-shadow,border-color,transform] duration-150",
                      "focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none",
                      "active:scale-[0.98]",
                      isSelected
                        ? "border-primary/40 bg-primary/10 text-foreground shadow-sm"
                        : "border-border/55 bg-white text-foreground shadow-sm shadow-black/[0.04] hover:border-primary/30 hover:bg-white",
                    )}
                  >
                    <span className="truncate">{shortName}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        </div>
        <DialogFooter
          className={cn(
            "mt-0 shrink-0 flex flex-col gap-3",
            "border-t border-border/35 bg-white px-5 py-4 !mx-0 !mb-0",
          )}
        >
          <div className="flex w-full gap-2.5">
            <Button
              type="button"
              variant="secondary"
              tone="light"
              className="h-11 flex-1 rounded-full border border-border/50 bg-white font-medium shadow-none hover:bg-zinc-50/90"
              onClick={onResetFilters}
            >
              {t("reset")}
            </Button>
            <Button
              type="button"
              className="h-11 flex-1 rounded-full font-medium shadow-sm"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              {t("done")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
