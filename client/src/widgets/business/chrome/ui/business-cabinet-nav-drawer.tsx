"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ChevronDown,
  LayoutDashboard,
  Menu,
  UserRound,
} from "lucide-react";
import { useState } from "react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/shadcn/collapsible";
import { Button } from "@/shared/ui";
import { cn, motion } from "@/shared/lib";

/** Один элемент списка (плоский). */
export type CabinetDrawerNavItem = {
  id: string;
  icon: LucideIcon;
  href: "/business" | "/business/bookings" | "/business/profile";
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
        id: "bookings",
        icon: CalendarDays,
        href: "/business/bookings",
        labelKey: "bookings",
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
  if (pathname.startsWith("/business/profile")) {
    return "profile";
  }
  return null;
}

function orgSubActive(pathname: string): "create" | "join" | "requests" | null {
  if (pathname.startsWith("/business/organizations/new")) {
    return "create";
  }
  if (pathname.startsWith("/business/organizations/join")) {
    return "join";
  }
  if (pathname.startsWith("/business/organizations/requests")) {
    return "requests";
  }
  return null;
}

function orgListHrefActive(pathname: string): boolean {
  return pathname === "/business/organizations" || pathname === "/business/organizations/";
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

function OrganizationsDrawerGroup({
  pathname,
  activeId,
  tNav,
  tPages,
}: {
  pathname: string;
  activeId: string | null;
  tNav: (key: string) => string;
  tPages: (key: string) => string;
}) {
  const orgsSectionActive = pathname.startsWith("/business/organizations");
  const [open, setOpen] = useState(orgsSectionActive);
  const parentNavActive = activeId === "organizations";
  const listPageActive = orgListHrefActive(pathname);
  const sub = orgSubActive(pathname);
  const headingId = "cabinet-nav-organizations-heading";
  const subId = "cabinet-nav-organizations-sub";

  const subLinkClass = (isActive: boolean) =>
    cn(
      motion.interactive,
      "flex min-h-9 w-full items-center rounded-md py-1.5 pr-2.5 pl-9 text-left text-[0.8125rem] leading-snug tracking-tight transition-colors",
      isActive ? "font-medium text-foreground" : "text-foreground/75 hover:bg-muted/30",
    );

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md">
      <div
        className={cn(
          "flex min-h-9 w-full items-stretch gap-0.5 rounded-md",
          parentNavActive ? "bg-muted/15" : "hover:bg-muted/10",
        )}
      >
        <DrawerClose asChild>
          <Link
            href="/business/organizations"
            className={cn(
              motion.interactive,
              "group/nav-item flex min-h-9 min-w-0 flex-1 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[0.875rem] leading-snug tracking-tight transition-colors",
              listPageActive ? "font-medium text-foreground" : "text-foreground/80 hover:bg-muted/25",
            )}
            aria-current={listPageActive ? "page" : undefined}
            id={headingId}
          >
            <Building2
              className={cn(
                "size-[1.0625rem] shrink-0",
                parentNavActive ? "text-foreground/90" : "text-muted-foreground group-hover/nav-item:text-foreground/55",
              )}
              strokeWidth={parentNavActive ? 2.125 : 1.75}
              aria-hidden
            />
            <span className="min-w-0 flex-1">{tNav("organizations")}</span>
          </Link>
        </DrawerClose>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              motion.interactive,
              "flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/30 hover:text-foreground/80",
              "focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
            )}
            aria-expanded={open}
            aria-controls={subId}
            aria-label={open ? tNav("organizationsSubmenuCollapseAria") : tNav("organizationsSubmenuExpandAria")}
          >
            <ChevronDown
              className={cn(
                "size-[1.0625rem] shrink-0 transition-transform duration-200 ease-out",
                open && "rotate-180",
              )}
              strokeWidth={2}
              aria-hidden
            />
          </button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent id={subId} role="region" aria-labelledby={headingId}>
        <ul className="mt-px flex flex-col gap-px pb-1" role="list">
          <li>
            <DrawerClose asChild>
              <Link
                href="/business/organizations/new"
                className={subLinkClass(sub === "create")}
                aria-current={sub === "create" ? "page" : undefined}
              >
                {tPages("createOrganization")}
              </Link>
            </DrawerClose>
          </li>
          <li>
            <DrawerClose asChild>
              <Link
                href="/business/organizations/join"
                className={subLinkClass(sub === "join")}
                aria-current={sub === "join" ? "page" : undefined}
              >
                {tPages("findJoinOrganization")}
              </Link>
            </DrawerClose>
          </li>
          <li>
            <DrawerClose asChild>
              <Link
                href="/business/organizations/requests"
                className={subLinkClass(sub === "requests")}
                aria-current={sub === "requests" ? "page" : undefined}
              >
                {tPages("organizationRequestsNav")}
              </Link>
            </DrawerClose>
          </li>
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Боковое меню кабинета: разделы + «Обратно в приложение». */
export function BusinessCabinetNavDrawerTrigger() {
  const tNav = useTranslations("businessAppNav");
  const tPages = useTranslations("businessAppSubpages");
  const tHeader = useTranslations("businessScreenHeader");
  const pathname = usePathname();
  const activeId = resolveActiveId(pathname);

  const mainItems = CABINET_DRAWER_NAV[0]?.items;
  if (!mainItems) {
    return null;
  }
  const beforeOrgs = mainItems.filter((i) => i.id === "dashboard");
  const afterOrgs = mainItems.filter((i) => i.id !== "dashboard");

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
            <DrawerNavRows items={beforeOrgs} activeId={activeId} tNav={tNav} />
            <OrganizationsDrawerGroup
              key={pathname.startsWith("/business/organizations") ? "in-orgs" : "out-orgs"}
              pathname={pathname}
              activeId={activeId}
              tNav={tNav}
              tPages={tPages}
            />
            <DrawerNavRows items={afterOrgs} activeId={activeId} tNav={tNav} />
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
