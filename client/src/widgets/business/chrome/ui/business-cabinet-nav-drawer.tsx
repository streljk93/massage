"use client";

import { useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  Calendar,
  ClipboardList,
  LayoutDashboard,
  Megaphone,
  Menu,
  Settings,
  Star,
  Tags,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/app/i18n/navigation";
import { openComingSoon } from "@/features/coming-soon";
import {
  canOrganization,
  OrganizationCapabilities,
  pickSelectedContextOrganization,
  useSpecialistMyOrganizationsQuery,
  type OrganizationCapability,
} from "@/entities/organizations";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/shared/ui/shadcn/drawer";
import { Skeleton } from "@/shared/ui/shadcn/skeleton";
import { Button, UserAvatar } from "@/shared/ui";
import { cn, motion } from "@/shared/lib";
import { OrgSwitcher } from "./org-switcher";
import { useBusinessCabinetAvatarSrc } from "../lib/use-business-cabinet-avatar-src";

const profileSettingsIconButtonClassName = cn(
  motion.interactive,
  "flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-muted/30 text-muted-foreground/70 outline-none transition-colors hover:bg-muted/45 hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
);

type NavLinkItem = {
  kind: "link";
  id: string;
  icon: LucideIcon;
  /** Если задано — пункт показывается только при наличии capability у выбранной организации. */
  requiredCapability?: OrganizationCapability;
  href:
    | "/business/dashboard"
    | "/business/bookings"
    | "/business/calendar"
    | "/business/clients"
    | "/business/hiring"
    | "/business/hiring/search"
    | "/business/profile"
    | "/business/specialists"
    | "/business/organizations";
  labelKey: string;
};

type NavSoonItem = {
  kind: "soon";
  id: string;
  icon: LucideIcon;
  /** Если задано — пункт показывается только при наличии capability у выбранной организации. */
  requiredCapability?: OrganizationCapability;
  labelKey: string;
};

/** Глобальные пункты — не привязаны к конкретной организации. */
const GLOBAL_NAV: readonly (NavLinkItem | NavSoonItem)[] = [
  {
    kind: "link",
    id: "workplaces",
    icon: Building2,
    href: "/business/organizations",
    labelKey: "workplaces",
  },
  {
    kind: "link",
    id: "jobSearch",
    icon: BriefcaseBusiness,
    href: "/business/hiring/search",
    labelKey: "jobSearch",
  },
];

/** Пункты, относящиеся к выбранной организации. */
const ORGANIZATION_NAV: readonly (NavLinkItem | NavSoonItem)[] = [
  {
    kind: "link",
    id: "dashboard",
    icon: LayoutDashboard,
    href: "/business/dashboard",
    labelKey: "dashboard",
  },
  {
    kind: "link",
    id: "clients",
    icon: Users,
    href: "/business/clients",
    labelKey: "clients",
  },
  {
    kind: "link",
    id: "bookings",
    icon: ClipboardList,
    href: "/business/bookings",
    labelKey: "bookings",
  },
  {
    kind: "link",
    id: "calendar",
    icon: Calendar,
    href: "/business/calendar",
    labelKey: "calendar",
  },
  {
    kind: "link",
    id: "specialists",
    icon: UserRound,
    href: "/business/specialists",
    labelKey: "specialists",
  },
  {
    kind: "link",
    id: "hiring",
    icon: BriefcaseBusiness,
    href: "/business/hiring",
    labelKey: "hiring",
    requiredCapability: OrganizationCapabilities.HIRING_VIEW,
  },
  {
    kind: "link",
    id: "services",
    icon: Tags,
    href: "/business/organizations",
    labelKey: "servicesAndPrices",
  },
  { kind: "soon", id: "finance", icon: Wallet, labelKey: "finance" },
  { kind: "soon", id: "reviews", icon: Star, labelKey: "reviews" },
  {
    kind: "soon",
    id: "marketing",
    icon: Megaphone,
    labelKey: "marketing",
    requiredCapability: OrganizationCapabilities.MARKETING_VIEW,
  },
  {
    kind: "soon",
    id: "analytics",
    icon: BarChart3,
    labelKey: "analytics",
    requiredCapability: OrganizationCapabilities.ANALYTICS_VIEW,
  },
];

function resolveActiveNavId(pathname: string): string | null {
  if (pathname.startsWith("/business/dashboard")) return "dashboard";
  if (pathname.startsWith("/business/bookings")) return "bookings";
  if (pathname.startsWith("/business/calendar")) return "calendar";
  if (pathname.startsWith("/business/clients")) return "clients";
  if (pathname.startsWith("/business/specialists")) return "specialists";
  if (pathname.startsWith("/business/hiring/search")) return "jobSearch";
  if (pathname.startsWith("/business/hiring")) return "hiring";
  if (pathname.startsWith("/business/organizations")) return "workplaces";
  if (pathname.startsWith("/business/profile")) return "profile";
  return null;
}

function initialsFromUser(user: {
  name?: string | null;
  email?: string | null;
}): string {
  const raw = user.name?.trim() || user.email?.split("@")[0] || "?";
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return raw.slice(0, 2).toUpperCase();
}

/** Единый список навигации. В drawer-режиме ссылки оборачиваются DrawerClose. */
function NavRows({
  items,
  activeId,
  tNav,
  mode,
}: {
  items: readonly (NavLinkItem | NavSoonItem)[];
  activeId: string | null;
  tNav: (key: string) => string;
  mode: "drawer" | "sidebar";
}) {
  const Wrap =
    mode === "drawer"
      ? DrawerClose
      : ({
          children,
        }: {
          children: React.ReactNode;
          asChild?: boolean;
        }) => <>{children}</>;
  return (
    <ul className="flex flex-col gap-0.5" role="list">
      {items.map((route) => {
        const Icon = route.icon;
        if (route.kind === "soon") {
          return (
            <li key={route.id}>
              <Wrap asChild>
                <button
                  type="button"
                  className={cn(
                    motion.interactive,
                    "flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[0.875rem] leading-snug tracking-tight transition-colors",
                    "text-foreground/75 hover:bg-muted/40",
                  )}
                  onClick={() => openComingSoon()}
                >
                  <Icon
                    className="size-[1.0625rem] shrink-0 text-muted-foreground"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">{tNav(route.labelKey)}</span>
                </button>
              </Wrap>
            </li>
          );
        }
        const active = route.id === activeId;
        return (
          <li key={route.id}>
            <Wrap asChild>
              <Link
                href={route.href}
                className={cn(
                  motion.interactive,
                  "group/nav-item flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[0.875rem] leading-snug tracking-tight transition-colors",
                  active
                    ? "bg-primary/12 font-medium text-primary"
                    : "text-foreground/85 hover:bg-muted/35",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  className={cn(
                    "size-[1.0625rem] shrink-0",
                    active
                      ? "text-primary"
                      : "text-muted-foreground group-hover/nav-item:text-foreground/70",
                  )}
                  strokeWidth={active ? 2.125 : 1.75}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">{tNav(route.labelKey)}</span>
              </Link>
            </Wrap>
          </li>
        );
      })}
    </ul>
  );
}

type NavPanelMode = "drawer" | "sidebar";

/**
 * Единый контент навигационной панели кабинета.
 * В drawer-режиме ссылки закрывают дровер; в sidebar — работают напрямую.
 */
function BusinessCabinetNavPanelContent({ mode }: { mode: NavPanelMode }) {
  const tNav = useTranslations("businessAppNav");
  const pathname = usePathname();
  const activeId = resolveActiveNavId(pathname);
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken ?? "";
  const authed = status === "authenticated" && accessToken.length > 0;

  const orgsQuery = useSpecialistMyOrganizationsQuery({ enabled: authed });
  const selectedOrg = useMemo(
    () => pickSelectedContextOrganization(orgsQuery.data),
    [orgsQuery.data],
  );
  const hasOrg = selectedOrg != null;

  const organizationNavItems = useMemo(() => {
    if (selectedOrg == null) return ORGANIZATION_NAV;
    return ORGANIZATION_NAV.filter((item) => {
      const cap = item.requiredCapability;
      if (cap == null) return true;
      return canOrganization(selectedOrg, cap);
    });
  }, [selectedOrg]);

  return (
    <>
      {/* OrgSwitcher — фиксирован, не скроллится вместе с навигацией */}
      {authed && (
        <div className="shrink-0 border-b border-border/15 px-3 py-2">
          <OrgSwitcher className="bg-primary/6 hover:bg-primary/10" />
        </div>
      )}

      {/* Навигация — скроллится */}
      <nav
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        aria-label={tNav("barLabel")}
      >
        {/* Орг-пункты — только когда выбрана организация */}
        {hasOrg && (
          <>
            <NavRows
              items={organizationNavItems}
              activeId={activeId}
              tNav={tNav}
              mode={mode}
            />
            <div className="my-2.5 h-px bg-border/25" aria-hidden />
          </>
        )}

        {/* Глобальные пункты */}
        <NavRows
          items={GLOBAL_NAV}
          activeId={activeId}
          tNav={tNav}
          mode={mode}
        />
      </nav>
    </>
  );
}

/** Плейсхолдер той же ширины, что и сайдбар (десктоп), пока грузятся сессия или онбординг. */
export function BusinessCabinetSidebarShell() {
  const t = useTranslations("businessScreenHeader");
  return (
    <aside
      className="sticky top-0 flex h-screen w-[min(calc(100vw-0.5rem),16rem)] shrink-0 flex-col overflow-hidden border-r border-border/30 bg-card md:w-64 lg:w-80"
      aria-busy="true"
      aria-label={t("sidebarShellAria")}
    >
      <div className="border-b border-border/15 px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2 py-0.5">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-3 w-36 rounded-md" />
          </div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-2 px-3 py-3" aria-hidden>
        {NAV_SHELL_SKELETON_IDS.map((id) => (
          <Skeleton key={id} className="h-9 w-full shrink-0 rounded-lg" />
        ))}
      </nav>
    </aside>
  );
}

const NAV_SHELL_SKELETON_IDS = [
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
] as const;

/** Постоянный сайдбар кабинета (десктоп). */
export function BusinessCabinetSidebar() {
  const tNav = useTranslations("businessAppNav");
  const { data: session } = useSession();
  const user = session?.user;
  const authed = !!session?.accessToken;
  const displayName =
    user?.name?.trim() || user?.email?.split("@")[0] || tNav("drawerGuestName");
  const displaySrc = useBusinessCabinetAvatarSrc();
  const displayFallback = user ? initialsFromUser(user) : "?";

  return (
    <aside className="sticky top-0 flex h-screen w-[min(calc(100vw-0.5rem),16rem)] shrink-0 flex-col overflow-hidden border-r border-border/30 bg-card md:w-64 lg:w-80">
      <div className="border-b border-border/15 px-4 pt-4 pb-3">
        <div className="flex min-w-0 w-full items-center gap-1.5">
          <Link
            href="/business/profile"
            className={cn(
              motion.interactive,
              "flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            )}
            aria-label={tNav("profileHeaderLinkAria")}
          >
            <UserAvatar
              src={displaySrc}
              alt={displayName}
              fallback={displayFallback}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <p className="font-heading text-base font-semibold tracking-tight text-foreground">
                {displayName}
              </p>
              <p className="text-xs text-muted-foreground">
                {authed
                  ? tNav("drawerAccountSubtitle")
                  : tNav("drawerGuestSubtitle")}
              </p>
            </div>
          </Link>
          <Link
            href="/business/profile"
            className={profileSettingsIconButtonClassName}
            aria-label={tNav("profileSettingsAria")}
          >
            <Settings
              className="size-[1.0625rem] shrink-0"
              strokeWidth={1.75}
              aria-hidden
            />
          </Link>
        </div>
      </div>
      <BusinessCabinetNavPanelContent mode="sidebar" />
    </aside>
  );
}

/** Кнопка-триггер мобильного дровера + сам дровер с навигацией. */
export function BusinessCabinetNavDrawerTrigger() {
  const tNav = useTranslations("businessAppNav");
  const tHeader = useTranslations("businessScreenHeader");
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken ?? "";
  const authed = status === "authenticated" && accessToken.length > 0;
  const user = session?.user;
  const displayName =
    user?.name?.trim() || user?.email?.split("@")[0] || tNav("drawerGuestName");
  const displaySrc = useBusinessCabinetAvatarSrc();
  const displayFallback = user ? initialsFromUser(user) : "?";

  return (
    <Drawer direction="left">
      <DrawerTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          tone="light"
          className={cn(
            motion.interactivePress,
            "h-[40px] w-[40px] min-h-[40px] min-w-[40px] max-h-[40px] max-w-[40px] shrink-0 rounded-full border border-border/40 bg-card/95 p-0 shadow-none md:hidden",
          )}
          aria-label={tHeader("openMenuAria")}
        >
          <Menu
            className="size-[1.15rem] text-muted-foreground"
            strokeWidth={2}
            aria-hidden
          />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="flex h-full min-h-0 max-h-[min(100dvh,100vh)] !w-[min(calc(100vw-0.5rem),16rem)] max-w-[85vw] flex-col overflow-hidden rounded-none rounded-r-2xl border-y-0 border-l-0 border-r border-border/30 bg-card pt-0 shadow-[4px_0_28px_-8px_rgba(0,0,0,0.12)]">
        <DrawerHeader className="space-y-0 border-b border-border/15 px-4 pt-4 pb-3 text-left">
          <div className="flex min-w-0 w-full items-center gap-1.5">
            <DrawerClose asChild>
              <Link
                href="/business/profile"
                className={cn(
                  motion.interactive,
                  "flex min-w-0 flex-1 items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                )}
                aria-label={tNav("profileHeaderLinkAria")}
              >
                <UserAvatar
                  src={displaySrc}
                  alt={displayName}
                  fallback={displayFallback}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <DrawerTitle className="font-heading text-base font-semibold tracking-tight text-foreground">
                    {displayName}
                  </DrawerTitle>
                  <DrawerDescription className="text-xs text-muted-foreground">
                    {authed
                      ? tNav("drawerAccountSubtitle")
                      : tNav("drawerGuestSubtitle")}
                  </DrawerDescription>
                </div>
              </Link>
            </DrawerClose>
            <DrawerClose asChild>
              <Link
                href="/business/profile"
                className={profileSettingsIconButtonClassName}
                aria-label={tNav("profileSettingsAria")}
              >
                <Settings
                  className="size-[1.0625rem] shrink-0"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </Link>
            </DrawerClose>
          </div>
        </DrawerHeader>
        <BusinessCabinetNavPanelContent mode="drawer" />
      </DrawerContent>
    </Drawer>
  );
}
