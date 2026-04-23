import type { ComponentProps } from "react";
import { cn } from "../lib";
import { Button as ShadcnButton } from "./shadcn/button";

export type ButtonTone = "light" | "muted";

export type ButtonProps = Omit<
  ComponentProps<typeof ShadcnButton>,
  "variant"
> & {
  variant?: "primary" | "secondary" | "ghost";
  /**
   * Для `variant="secondary"`: `light` — `surface-light` (как поиск, по умолчанию для таких кнопок),
   * `muted` — нейтральная. Без `tone` — стандартные цвета shadcn `secondary` (бренд и т.д.).
   */
  tone?: ButtonTone;
};

const variantMap = {
  primary: "default",
  secondary: "secondary",
  ghost: "ghost",
} as const;

export function Button({
  className,
  variant = "primary",
  tone,
  ...props
}: ButtonProps) {
  return (
    <ShadcnButton
      variant={variantMap[variant]}
      className={cn(
        variant === "secondary" &&
          tone === "light" &&
          "border-0 bg-surface-light text-foreground hover:bg-surface-muted hover:text-foreground",
        variant === "secondary" &&
          tone === "muted" &&
          "border-0 bg-muted hover:bg-muted/80",
        className,
      )}
      {...props}
    />
  );
}
