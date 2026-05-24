"use client";

import { useTranslations } from "next-intl";
import type { SearchTab } from "@/shared/lib/search-tab";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui";

export type SearchFiltersResultHintProps = {
  /** Ключ для перемонтажа Tooltip при новом показе */
  animateKey: number;
  count: number;
  tab: SearchTab;
};

/** Рядом справа от колонки фильтров (desktop): счётчик в shadcn Tooltip. */
export function SearchFiltersResultHint({
  animateKey,
  count,
  tab,
}: SearchFiltersResultHintProps) {
  const t = useTranslations("search");
  const label =
    tab === "organizations" ?
      t("filtersAppliedCountOrgs", { count })
    : t("filtersAppliedCountSpecs", { count });

  return (
    <Tooltip
      key={animateKey}
      open
      delayDuration={0}
      disableHoverableContent
    >
      <TooltipTrigger asChild>
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none relative z-0 flex size-px min-h-px min-w-px shrink-0 items-center justify-center border-0 bg-transparent p-0"
        />
      </TooltipTrigger>
      <TooltipContent
        avoidCollisions={false}
        side="right"
        align="center"
        sideOffset={12}
        showArrow={false}
        role="status"
        aria-live="polite"
        className="max-w-[min(14rem,calc(100vw-10rem))] px-3 py-2 text-xs font-medium leading-snug text-pretty shadow-md"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
