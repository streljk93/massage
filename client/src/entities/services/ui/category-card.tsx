import type { ComponentProps, ReactNode } from "react";
import { Link } from "@/app/i18n/navigation";
import { cn, motion } from "@/shared/lib";

export type CategoryCardProps = Omit<ComponentProps<"button">, "children"> & {
  icon: ReactNode;
  label: string;
  /** Если задан — рендерится как ссылка (например на поиск с фильтром по категории). */
  href?: string;
};

export function CategoryCard({
  icon,
  label,
  className,
  href,
  type = "button",
  ...props
}: CategoryCardProps) {
  const cardClassName = cn(
    motion.interactivePress,
    "flex w-[4.5rem] shrink-0 flex-col items-center gap-2 rounded-2xl bg-card p-3 text-center hover:bg-muted/60 sm:w-[5rem]",
    className,
  );

  const contents = (
    <>
      <span className="flex size-10 items-center justify-center text-foreground sm:size-11">
        {icon}
      </span>
      <span className="text-[0.7rem] leading-tight font-medium text-muted-foreground sm:text-xs">
        {label}
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cardClassName}>
        {contents}
      </Link>
    );
  }

  return (
    <button type={type} className={cardClassName} {...props}>
      {contents}
    </button>
  );
}
