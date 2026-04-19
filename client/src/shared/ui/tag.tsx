import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../lib";

export const tagVariants = cva(
  "inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground",
        outline: "bg-muted/80 text-foreground",
        inverse: "bg-white/20 text-white",
        slot: "bg-background text-foreground",
      },
      bordered: {
        false: "",
        true: "border border-border !bg-transparent text-foreground shadow-none",
      },
    },
    defaultVariants: {
      variant: "default",
      bordered: false,
    },
  },
);

export type TagProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof tagVariants>;

export function Tag({ className, variant, bordered, ...props }: TagProps) {
  return (
    <span
      className={cn(tagVariants({ variant, bordered }), className)}
      {...props}
    />
  );
}
