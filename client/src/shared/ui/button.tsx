import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({
  className,
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-ring)] disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" &&
          "bg-[var(--ds-primary)] text-[var(--ds-primary-fg)] hover:opacity-90",
        variant === "secondary" &&
          "border border-[var(--ds-border)] bg-[var(--ds-surface)] text-[var(--ds-fg)] hover:bg-[var(--ds-muted)]",
        variant === "ghost" &&
          "text-[var(--ds-fg)] hover:bg-[var(--ds-muted)]",
        className,
      )}
      {...props}
    />
  );
}
