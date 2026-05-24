"use client";

import type { ReactNode } from "react";
import { Checkbox } from "@/shared/ui";
import { cn } from "@/shared/lib";

/** Ширина desktop-панели фильтров (px), согласована с табами поиска. */
export const catalogFiltersPanelWidthClass =
  "w-[318px] min-w-[318px] max-w-[318px]";

export function CatalogFilterSection({
  title,
  headingId,
  children,
  className,
}: {
  title: string;
  headingId?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("space-y-2.5", className)}
      aria-labelledby={headingId}
    >
      <h3
        id={headingId}
        className="text-sm font-semibold leading-snug text-foreground"
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

export function CatalogFilterCheckboxRow({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 py-1.5"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => {
          onCheckedChange(value === true);
        }}
        className="mt-0.5"
      />
      <span className="min-w-0 text-sm leading-snug text-foreground">
        {label}
      </span>
    </label>
  );
}

export function CatalogFilterRadioRow({
  id,
  name,
  label,
  checked,
  onSelect,
}: {
  id: string;
  name: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 py-1.5"
    >
      <input
        id={id}
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="mt-1 size-4 shrink-0 accent-primary"
      />
      <span className="min-w-0 text-sm leading-snug text-foreground">
        {label}
      </span>
    </label>
  );
}
