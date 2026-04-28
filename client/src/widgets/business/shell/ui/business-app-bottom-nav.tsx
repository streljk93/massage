"use client";

import { CalendarDays, LayoutDashboard, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/app/i18n/navigation";
import { cn, motion } from "@/shared/lib";

const items = [
  {
    id: "dashboard" as const,
    icon: LayoutDashboard,
    href: "/business" as const,
    labelKey: "dashboard" as const,
  },
  {
    id: "bookings" as const,
    icon: CalendarDays,
    href: "/business/bookings" as const,
    labelKey: "bookings" as const,
  },
  {
    id: "profile" as const,
    icon: UserRound,
    href: "/business/profile" as const,
    labelKey: "profile" as const,
  },
] as const;

function resolveActiveId(
  pathname: string,
): (typeof items)[number]["id"] | null {
  if (pathname === "/business" || pathname === "/business/") {
    return "dashboard";
  }
  if (pathname.startsWith("/business/bookings")) {
    return "bookings";
  }
  if (pathname.startsWith("/business/profile")) {
    return "profile";
  }
  return null;
}

export function BusinessAppBottomNav({ className }: { className?: string }) {
  const t = useTranslations("businessAppNav");
  const pathname = usePathname();
  const activeId = resolveActiveId(pathname);

  return (
    <div
      className={cn(
        "fixed right-0 bottom-0 left-0 z-50 flex flex-col border-t border-border/40 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md",
        className,
      )}
    >
      <nav className="w-full" aria-label={t("barLabel")}>
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
            return (
              <Link
                key={id}
                href={href}
                className={itemClassName}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                {t(labelKey)}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
