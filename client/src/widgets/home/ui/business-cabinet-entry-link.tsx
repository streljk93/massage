"use client";

import { Crown } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { Link } from "@/app/i18n/navigation";
import { cn, motion } from "@/shared/lib";

export type BusinessCabinetEntryVariant = "headerChip" | "profileBanner";

const chipBase =
  "inline-flex max-w-full items-center gap-2 bg-neutral-950 font-semibold text-neutral-50 shadow-sm transition-colors hover:bg-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-950/30 focus-visible:outline-none dark:bg-neutral-950 dark:hover:bg-neutral-800";

type Props = Omit<
  ComponentPropsWithoutRef<typeof Link>,
  "href" | "children" | "className"
> & {
  label: string;
  variant?: BusinessCabinetEntryVariant;
  /** Дополнительные классы (напр. контейнер) */
  className?: string;
};

/**
 * Переход в бизнес-кабинет: корона + текст, тёмная «кнопка» как на главном и в профиле.
 */
export function BusinessCabinetEntryLink({
  label,
  variant = "headerChip",
  className,
  ...linkProps
}: Props) {
  return (
    <Link
      {...linkProps}
      href="/business/organizations"
      prefetch={false}
      title={label}
      aria-label={label}
      className={cn(
        motion.interactivePress,
        chipBase,
        variant === "headerChip" &&
          "shrink-0 rounded-full px-3 py-1.5 text-xs whitespace-nowrap",
        variant === "profileBanner" &&
          "w-full justify-start rounded-2xl px-4 py-3.5 text-sm shadow-md",
        className,
      )}
    >
      <Crown
        className={cn(
          "shrink-0 text-neutral-50",
          variant === "headerChip" ? "size-[0.9375rem]" : "size-5",
        )}
        aria-hidden
        strokeWidth={2.25}
      />
      <span className="min-w-0 truncate">{label}</span>
    </Link>
  );
}
