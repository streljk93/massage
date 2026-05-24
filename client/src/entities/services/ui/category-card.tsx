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
    "flex h-[4.25rem] w-[4.35rem] shrink-0 flex-col items-center justify-center gap-1 rounded-xl bg-card px-1.5 py-1.5 text-center hover:bg-muted/60 sm:h-[4.5rem] sm:w-[4.6rem] lg:h-[4.5rem] lg:w-full lg:shrink",
    className,
  );

  const contents = (
    <>
      <span
        className="flex h-7 items-center justify-center text-[1.35rem] leading-none sm:text-[1.45rem]"
        aria-hidden
      >
        {icon}
      </span>
      <span className="line-clamp-2 w-full text-[0.65rem] leading-[0.85rem] font-medium text-muted-foreground sm:text-[0.7rem] sm:leading-[0.92rem]">
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
