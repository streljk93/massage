"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  LayoutDashboard,
  Menu,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/app/i18n/navigation";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/shared/ui/shadcn/drawer";
import { Button } from "@/shared/ui";
import { cn, motion } from "@/shared/lib";

/** Один элемент списка (плоский). */
export type CabinetDrawerNavItem = {
  id: string;
  icon: LucideIcon;
  href:
    | "/business"
    | "/business/bookings"
    | "/business/skills"
    | "/business/profile"
    | "/business/organizations";
  /** Ключ строки из `businessAppNav` */
  labelKey: string;
};

/** Одна секция меню. */
export type CabinetDrawerNavSection = {
  sectionId: string;
  groupLabelKey?: string;
  items: readonly CabinetDrawerNavItem[];
};

const CABINET_DRAWER_NAV: readonly CabinetDrawerNavSection[] = [
  {
    sectionId: "main",
    items: [
      {
        id: "dashboard",
        icon: LayoutDashboard,
        href: "/business",
        labelKey: "dashboard",
      },
      {
        id: "organizations",
        icon: Building2,
        href: "/business/organizations",
        labelKey: "organizations",
      },
      {
        id: "bookings",
        icon: CalendarDays,
        href: "/business/bookings",
        labelKey: "bookings",
      },
      {
        id: "skills",
        icon: Sparkles,
        href: "/business/skills",
        labelKey: "skills",
      },
      {
        id: "profile",
        icon: UserRound,
        href: "/business/profile",
        labelKey: "profile",
      },
    ],
  },
];

function resolveActiveId(pathname: string): string | null {
  if (pathname === "/business" || pathname === "/business/") {
    return "dashboard";
  }
  if (pathname.startsWith("/business/organizations")) {
    return "organizations";
  }
  if (pathname.startsWith("/business/bookings")) {
    return "bookings";
  }
  if (pathname.startsWith("/business/skills")) {
    return "skills";
  }
  if (pathname.startsWith("/business/profile")) {
    return "profile";
  }
  return null;
}

function DrawerNavRows({
  items,
  activeId,
  tNav,
}: {
  items: readonly CabinetDrawerNavItem[];
  activeId: string | null;
  tNav: (key: string) => string;
}) {
  return (
    <ul className="flex flex-col gap-px" role="list">
      {items.map((route) => {
        const active = route.id === activeId;
        const label = tNav(route.labelKey);
        const Icon = route.icon;
        return (
          <li key={route.id}>
            <DrawerClose asChild>
              <Link
                href={route.href}
                className={cn(
                  motion.interactive,
                  "group/nav-item flex min-h-9 w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[0.875rem] leading-snug tracking-tight transition-colors",
                  active ? "font-medium text-foreground" : "text-foreground/80 hover:bg-muted/30",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  className={cn(
                    "size-[1.0625rem] shrink-0",
                    active ? "text-foreground/90" : "text-muted-foreground group-hover/nav-item:text-foreground/55",
                  )}
                  strokeWidth={active ? 2.125 : 1.75}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">{label}</span>
              </Link>
            </DrawerClose>
          </li>
        );
      })}
    </ul>
  );
}

/** Боковое меню кабинета: разделы + «Обратно в приложение». */
export function BusinessCabinetNavDrawerTrigger() {
  const tNav = useTranslations("businessAppNav");
  const tHeader = useTranslations("businessScreenHeader");
  const pathname = usePathname();
  const activeId = resolveActiveId(pathname);

  const mainItems = CABINET_DRAWER_NAV[0]?.items;
  if (!mainItems) {
    return null;
  }

  return (
    <Drawer direction="left">
      <DrawerTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          tone="light"
          className={cn(
            motion.interactivePress,
            "h-[40px] w-[40px] min-h-[40px] min-w-[40px] max-h-[40px] max-w-[40px] shrink-0 rounded-full border border-border/40 bg-surface-light/90 p-0 shadow-none",
          )}
          aria-label={tHeader("openMenuAria")}
        >
          <Menu className="size-[1.15rem] text-muted-foreground" strokeWidth={2} aria-hidden />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="flex h-full min-h-0 max-h-[min(100dvh,100vh)] flex-col overflow-hidden border-r border-border/25 bg-surface-light pt-0 shadow-[2px_0_32px_-12px_rgba(0,0,0,0.06)] dark:shadow-[2px_0_32px_-12px_rgba(0,0,0,0.45)]">
        <DrawerHeader className="space-y-0.5 border-b border-border/15 px-4 pt-5 pb-3 text-left">
          <DrawerTitle className="font-heading text-base font-semibold tracking-tight text-foreground">
            {tNav("drawerTitle")}
          </DrawerTitle>
          <DrawerDescription className="sr-only">{tNav("barLabel")}</DrawerDescription>
        </DrawerHeader>
        <nav
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2.5"
          aria-label={tNav("barLabel")}
        >
          <section className="space-y-1">
            <DrawerNavRows items={mainItems} activeId={activeId} tNav={tNav} />
          </section>
        </nav>
        <div className="shrink-0 border-t border-border/15 bg-muted/10 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <DrawerFooter className="px-3 py-2.5 pt-3">
            <DrawerClose asChild>
              <Link
                href="/"
                className={cn(
                  motion.interactive,
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[0.875rem] font-medium text-muted-foreground transition-colors",
                  "hover:bg-muted/30 hover:text-foreground",
                  "focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
                )}
                aria-label={tHeader("backToAppAria")}
              >
                <ArrowLeft className="size-4 shrink-0 opacity-70" strokeWidth={2} aria-hidden />
                {tHeader("backToApp")}
              </Link>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
