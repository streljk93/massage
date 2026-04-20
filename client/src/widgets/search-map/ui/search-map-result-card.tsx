import { Star } from "lucide-react";
import { cn } from "@/shared/lib";

export type SearchMapResultCardProps = {
  name: string;
  imageSrc: string;
  imageAlt: string;
  rating: number;
  /** Одна строка: расстояние / адрес */
  metaLine: string;
  className?: string;
};

export function SearchMapResultCard({
  name,
  imageSrc,
  imageAlt,
  rating,
  metaLine,
  className,
}: SearchMapResultCardProps) {
  return (
    <article
      className={cn(
        "flex min-h-0 items-center gap-2 rounded-2xl p-2",
        className,
      )}
    >
      <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote placeholders */}
        <img
          src={imageSrc}
          alt={imageAlt}
          className="size-full object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <h3 className="truncate font-heading text-sm font-semibold tracking-tight text-foreground">
            {name}
          </h3>
          <div className="flex shrink-0 items-center gap-0.5 text-foreground">
            <Star
              className="size-3 fill-amber-400 text-amber-400"
              strokeWidth={0}
              aria-hidden
            />
            <span className="text-xs font-semibold tabular-nums">
              {rating.toFixed(1)}
            </span>
          </div>
        </div>
        <p className="truncate text-xs text-muted-foreground">{metaLine}</p>
      </div>
    </article>
  );
}
