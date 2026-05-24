import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib";

export type EntityCardProps = HTMLAttributes<HTMLElement>;

export function EntityCard({ className, ...props }: EntityCardProps) {
  return (
    <article
      className={cn(
        /* overflow-visible: горизонтальный скролл слотов на iOS ломается при overflow-hidden у предка */
        "flex min-w-0 items-stretch overflow-visible rounded-2xl bg-card",
        className,
      )}
      {...props}
    />
  );
}

export type EntityCardImageProps = {
  src: string;
  alt: string;
  className?: string;
};

export function EntityCardImage({ src, alt, className }: EntityCardImageProps) {
  return (
    <div
      className={cn(
        "relative w-[calc(var(--spacing)*38)] shrink-0 self-stretch overflow-hidden rounded-l-2xl bg-muted",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- remote placeholders */}
      <img
        src={src}
        alt={alt}
        className="absolute inset-0 size-full object-cover"
      />
    </div>
  );
}

export type EntityCardContentProps = {
  children: ReactNode;
  className?: string;
};

export function EntityCardContent({
  children,
  className,
}: EntityCardContentProps) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col gap-1 p-3", className)}>
      {children}
    </div>
  );
}
