import { MapPin } from "lucide-react";
import { UserAvatar } from "@/shared/ui/avatar";
import { cn } from "@/shared/lib";
import { LocaleSwitcher } from "./locale-switcher";

export type HomeScreenHeaderProps = {
  locationLabel: string;
  title: string;
  avatarSrc: string;
  avatarAlt: string;
  avatarFallback: string;
  className?: string;
};

export function HomeScreenHeader({
  locationLabel,
  title,
  avatarSrc,
  avatarAlt,
  avatarFallback,
  className,
}: HomeScreenHeaderProps) {
  return (
    <header
      className={cn("flex items-start justify-between gap-3", className)}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <p className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{locationLabel}</span>
          </p>
          <LocaleSwitcher className="shrink-0" />
        </div>
        <h1 className="font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h1>
      </div>
      <UserAvatar
        src={avatarSrc}
        alt={avatarAlt}
        fallback={avatarFallback}
        size="lg"
      />
    </header>
  );
}
