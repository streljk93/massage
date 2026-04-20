import { Star } from "lucide-react";
import { Link } from "@/app/i18n/navigation";
import { cn } from "@/shared/lib";

export type SearchMapResultCardProps = {
  name: string;
  imageSrc: string;
  imageAlt: string;
  rating: number;
  /** Одна строка: расстояние / адрес */
  metaLine: string;
  /** Открыть профиль (организация или специалист). */
  profileHref?: string;
  className?: string;
};

export function SearchMapResultCard({
  name,
  imageSrc,
  imageAlt,
  rating,
  metaLine,
  profileHref,
  className,
}: SearchMapResultCardProps) {
  const body = (
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

  if (!profileHref) {
    return body;
  }

  return (
    <Link
      href={profileHref}
      className="block min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={name}
    >
      {body}
    </Link>
  );
}
