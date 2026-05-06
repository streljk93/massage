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
    "flex h-[4.65rem] w-[3.9rem] shrink-0 flex-col items-center justify-between rounded-xl bg-card px-2 py-2 text-center hover:bg-muted/60 sm:h-[5rem] sm:w-[4.3rem]",
    className,
  );

  const contents = (
    <>
      <span className="flex size-8 items-center justify-center text-foreground sm:size-9">
        {icon}
      </span>
      <span className="line-clamp-2 text-[0.72rem] leading-[0.96rem] font-medium text-muted-foreground sm:text-[0.8rem]">
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
