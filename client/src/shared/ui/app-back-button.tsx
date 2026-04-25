"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "@/app/i18n/navigation";
import { goBackOrFallback } from "@/shared/lib";
import { cn, motion } from "@/shared/lib";

export type AppBackButtonProps = {
  /** Куда вести при прямом заходе / пустой истории (без префикса локали). */
  fallback: string;
  ariaLabel: string;
  className?: string;
};

export function AppBackButton({
  fallback,
  ariaLabel,
  className,
}: AppBackButtonProps) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        goBackOrFallback(router, fallback);
      }}
      aria-label={ariaLabel}
      className={cn(
        motion.interactivePressStrong,
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full border-0 bg-muted/50 text-foreground",
        className,
      )}
    >
      <ArrowLeft className="size-5" aria-hidden />
    </button>
  );
}
