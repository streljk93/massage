import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/shared/lib";

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
        "inline-flex cursor-pointer items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" &&
          "bg-surface-primary text-action-on-primary hover:opacity-90",
        variant === "secondary" &&
          "border border-border bg-surface-secondary text-action-on-secondary hover:opacity-90",
        variant === "ghost" &&
          "text-text-primary hover:bg-surface-muted",
        className,
      )}
      {...props}
    />
  );
}
