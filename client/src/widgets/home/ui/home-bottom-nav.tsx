"use client";

import { CalendarDays, Home, Search, UserRound } from "lucide-react";
import { cn, motion } from "@/shared/lib";

const items = [
  { id: "home", label: "Home", icon: Home },
  { id: "search", label: "Search", icon: Search },
  { id: "bookings", label: "Bookings", icon: CalendarDays },
  { id: "profile", label: "Profile", icon: UserRound },
] as const;

export type HomeBottomNavProps = {
  activeId?: (typeof items)[number]["id"];
  className?: string;
};

export function HomeBottomNav({
  activeId = "home",
  className,
}: HomeBottomNavProps) {
  return (
    <nav
      className={cn(
        "fixed right-0 bottom-0 left-0 z-50 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md",
        className,
      )}
      aria-label="Основная навигация"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-2 pb-1">
        {items.map(({ id, label, icon: Icon }) => {
          const active = id === activeId;
          return (
            <button
              key={id}
              type="button"
              className={cn(
                motion.interactive,
                motion.press,
                "flex min-w-[3.5rem] flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[0.65rem] font-medium",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
