"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/shared/lib";

const PLACEHOLDER_GRADIENTS = [
  "from-surface-muted to-surface-secondary/80",
  "from-primary/25 to-surface-muted",
  "from-surface-secondary/70 to-primary/20",
  "from-surface-muted to-primary/15",
] as const;

export type ProfilePortfolioPlaceholderProps = {
  className?: string;
  /** Sidebar in hero — fixed height grid */
  variant?: "default" | "hero";
};

export function ProfilePortfolioPlaceholder({
  className,
  variant = "default",
}: ProfilePortfolioPlaceholderProps) {
  const t = useTranslations("profileVitrine");
  const isHero = variant === "hero";

  return (
    <section className={cn("space-y-3.5", className)}>
      <h2 className="font-heading text-xl font-bold tracking-tight text-foreground">
        {t("portfolioTitle")}
      </h2>
      <div
        className={cn(
          "grid grid-cols-2 gap-2",
          isHero && "h-[380px] gap-2",
        )}
      >
        {PLACEHOLDER_GRADIENTS.map((gradient, index) => (
          <div
            key={index}
            className={cn(
              "rounded-lg bg-gradient-to-br",
              isHero ? "min-h-0" : "aspect-square rounded-xl",
              gradient,
            )}
            aria-hidden
          />
        ))}
      </div>
      {!isHero ? (
        <p className="text-xs text-muted-foreground">
          {t("portfolioPlaceholderCaption")}
        </p>
      ) : null}
    </section>
  );
}
