"use client";

import { useTranslations } from "next-intl";
import { CalendarDays, Home, Search, UserRound } from "lucide-react";
import { Link } from "@/app/i18n/navigation";
import { cn, motion } from "@/shared/lib";

const items = [
  { id: "home", icon: Home, href: "/" as const, labelKey: "nav.home" as const },
  {
    id: "search",
    icon: Search,
    href: "/search" as const,
    labelKey: "nav.search" as const,
  },
  {
    id: "bookings",
    icon: CalendarDays,
    href: null,
    labelKey: "nav.bookings" as const,
  },
  {
    id: "profile",
    icon: UserRound,
    href: null,
    labelKey: "nav.profile" as const,
  },
] as const;

export type HomeBottomNavProps = {
  activeId?: (typeof items)[number]["id"];
  className?: string;
};

export function HomeBottomNav({
  activeId = "home",
  className,
}: HomeBottomNavProps) {
  const t = useTranslations();

  return (
    <nav
      className={cn(
        "fixed right-0 bottom-0 left-0 z-50 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md",
        className,
      )}
      aria-label={t("nav.mainLabel")}
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-2 pb-1">
        {items.map(({ id, labelKey, icon: Icon, href }) => {
          const active = id === activeId;
          const itemClassName = cn(
            motion.interactivePressStrong,
            "flex min-w-[3.5rem] flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[0.65rem] font-medium",
            active
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          );
          const inner = (
            <>
              <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
              {t(labelKey)}
            </>
          );
          return href ? (
            <Link
              key={id}
              href={href}
              className={itemClassName}
              aria-current={active ? "page" : undefined}
            >
              {inner}
            </Link>
          ) : (
            <button key={id} type="button" className={itemClassName}>
              {inner}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
