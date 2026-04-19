import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib";

export type EntityCardProps = HTMLAttributes<HTMLElement>;

export function EntityCard({ className, ...props }: EntityCardProps) {
  return (
    <article
      className={cn(
        "flex gap-3 overflow-hidden rounded-2xl bg-card p-3",
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
        "relative size-[4.5rem] shrink-0 overflow-hidden rounded-xl bg-muted sm:size-24",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- remote placeholders */}
      <img src={src} alt={alt} className="size-full object-cover" />
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
    <div className={cn("flex min-w-0 flex-1 flex-col gap-1", className)}>
      {children}
    </div>
  );
}
