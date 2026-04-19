"use client";

import { ScanLine } from "lucide-react";
import { Search, type SearchOption, type SearchProps } from "@/shared/ui/search";
import { cn, motion } from "@/shared/lib";

export type SpecialistSearchOption = SearchOption;

export type SpecialistSearchProps = Omit<SearchProps, "endAdornment"> & {
  /** Кнопка справа (иконка фильтра / сканера) */
  onFilterClick?: () => void;
};

const endButtonTone: Record<
  NonNullable<SearchProps["variant"]>,
  string
> = {
  light: "hover:bg-surface-muted",
  muted: "hover:bg-muted/80",
};

export function SpecialistSearch({
  variant = "light",
  placeholder = "Search specialist...",
  onFilterClick,
  ...props
}: SpecialistSearchProps) {
  const hover = endButtonTone[variant];

  return (
    <Search
      variant={variant}
      placeholder={placeholder}
      endAdornment={
        <button
          type="button"
          className={cn(
            motion.interactivePress,
            "flex size-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground",
            hover,
          )}
          aria-label="Фильтры"
          onClick={() => onFilterClick?.()}
        >
          <ScanLine className="size-5" />
        </button>
      }
      {...props}
    />
  );
}
