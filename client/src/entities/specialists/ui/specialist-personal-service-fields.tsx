"use client";

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
  DURATION_MINUTES_MAX,
  DURATION_MINUTES_MIN,
  digitsFromVndPriceInput,
  formatVndPriceForInput,
  nextMinutesWhenAddingDuration,
  type Cat,
  type SvcForm,
} from "../lib/personal-service-catalog-draft";

export type SpecialistPersonalServiceFieldsProps = {
  categories: Cat[];
  value: SvcForm;
  onChange: (next: SvcForm) => void;
  disabled?: boolean;
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
  categoryLabelVariant = "prominent",
}: SpecialistPersonalServiceFieldsProps) {
  const tOnb = useTranslations("specialistOnboarding");

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
          onValueChange={(v) => onChange({ ...value, categoryId: v })}
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
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-0 bg-muted/45 px-3 text-sm font-medium text-muted-foreground shadow-none hover:bg-muted/50 hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring/35 sm:w-auto"
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
