import type { HTMLAttributes } from "react";
import { cn } from "../lib";

export type TextProps = HTMLAttributes<HTMLParagraphElement> & {
  as?: "p" | "span";
  tone?: "default" | "muted";
};

export function Text({
  as: Component = "p",
  className,
  tone = "default",
  ...props
}: TextProps) {
  return (
    <Component
      className={cn(
        "text-base leading-relaxed",
        tone === "muted" && "text-[var(--ds-text-muted)]",
        tone === "default" && "text-[var(--ds-text-primary)]",
        className,
      )}
      {...props}
    />
  );
}
