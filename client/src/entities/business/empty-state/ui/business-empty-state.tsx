import type { LucideIcon } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/shared/ui/shadcn/empty";
import { cn } from "@/shared/lib";

export type BusinessEmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
};

/**
 * Пустое состояние в кабинете бизнеса: мягкий блок без тени, с иконкой в цвете primary.
 */
export function BusinessEmptyState({
  icon: Icon,
  title,
  description,
  className,
}: BusinessEmptyStateProps) {
  return (
    <Empty
      className={cn(
        "rounded-2xl border border-border/40 bg-muted/15 py-9 sm:py-10",
        className,
      )}
    >
      <EmptyHeader className="max-w-md gap-3">
        <div
          className="mb-0.5 flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"
          aria-hidden
        >
          <Icon className="size-7" strokeWidth={1.65} />
        </div>
        <EmptyTitle className="text-base font-semibold text-foreground">
          {title}
        </EmptyTitle>
        <EmptyDescription className="px-0.5 text-[0.9375rem] leading-relaxed">
          {description}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
