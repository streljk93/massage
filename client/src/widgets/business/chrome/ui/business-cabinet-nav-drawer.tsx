"use client";

import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  Calendar,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  Megaphone,
  Menu,
  Plus,
  Sparkles,
  Star,
  Tags,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/app/i18n/navigation";
import { openComingSoon } from "@/features/coming-soon";
import {
  BusinessActiveOrganizationContextCard,
  displayNameForCabinetOrganization,
  pickActiveWorkplaceOrganization,
  useSpecialistMyOrganizationsQuery,
} from "@/entities/organizations";
import { previewSrcForPersistedGalleryUrl } from "@/shared/lib";
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
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  UserAvatar,
} from "@/shared/ui";
import { cn, motion } from "@/shared/lib";
import { useMemo, useState } from "react";

type NavLinkItem = {
  kind: "link";
  id: string;
  icon: LucideIcon;
  href:
    | "/business"
    | "/business/bookings"
    | "/business/calendar"
    | "/business/clients"
    | "/business/hiring"
    | "/business/specialists"
    | "/business/skills"
    | "/business/organizations";
  labelKey: string;
};

type NavSoonItem = {
  kind: "soon";
  id: string;
  icon: LucideIcon;
  labelKey: string;
};

const MAIN_NAV: readonly (NavLinkItem | NavSoonItem)[] = [
  {
    kind: "link",
    id: "dashboard",
    icon: LayoutDashboard,
    href: "/business",
    labelKey: "dashboard",
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
    id: "organizations",
    icon: Building2,
    href: "/business/organizations",
    labelKey: "organizations",
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
  },
  {
    kind: "link",
    id: "services",
    icon: Tags,
    href: "/business/organizations",
    labelKey: "servicesAndPrices",
  },
  {
    kind: "link",
    id: "skills",
    icon: Sparkles,
    href: "/business/skills",
    labelKey: "skills",
  },
  { kind: "soon", id: "finance", icon: Wallet, labelKey: "finance" },
  { kind: "soon", id: "reviews", icon: Star, labelKey: "reviews" },
  { kind: "soon", id: "marketing", icon: Megaphone, labelKey: "marketing" },
  { kind: "soon", id: "analytics", icon: BarChart3, labelKey: "analytics" },
];

function resolveActiveNavId(pathname: string): string | null {
  if (pathname === "/business" || pathname === "/business/") {
    return "dashboard";
  }
  if (pathname.startsWith("/business/bookings")) {
    return "bookings";
  }
  if (pathname.startsWith("/business/calendar")) {
    return "calendar";
  }
  if (pathname.startsWith("/business/clients")) {
    return "clients";
  }
  if (pathname.startsWith("/business/specialists")) {
    return "specialists";
  }
  if (pathname.startsWith("/business/hiring")) {
    return "hiring";
  }
  if (pathname.startsWith("/business/organizations")) {
    return "organizations";
  }
  if (pathname.startsWith("/business/skills")) {
    return "skills";
  }
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
  const Wrap = mode === "drawer" ? DrawerClose : ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>;
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
                  <Icon className="size-[1.0625rem] shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
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
                  active ? "bg-primary/12 font-medium text-primary" : "text-foreground/85 hover:bg-muted/35",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  className={cn(
                    "size-[1.0625rem] shrink-0",
                    active ? "text-primary" : "text-muted-foreground group-hover/nav-item:text-foreground/70",
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
  const tCard = useTranslations("businessActiveOrganizationContextCard");
  const pathname = usePathname();
  const activeId = resolveActiveNavId(pathname);
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken ?? "";
  const authed = status === "authenticated" && accessToken.length > 0;

  const orgsQuery = useSpecialistMyOrganizationsQuery({ enabled: authed });
  const activeOrg = useMemo(
    () => pickActiveWorkplaceOrganization(orgsQuery.data),
    [orgsQuery.data],
  );
  const activeOrgId =
    typeof orgsQuery.data?.activeOrganizationId === "string"
      ? orgsQuery.data.activeOrganizationId
      : null;
  const otherOrgs = useMemo(() => {
    const rows = orgsQuery.data?.organizations ?? [];
    return rows.filter(
      (o) =>
        o.membershipStatus === "employed" &&
        (activeOrgId == null || o.id !== activeOrgId),
    );
  }, [orgsQuery.data?.organizations, activeOrgId]);

  const [otherOrgsOpen, setOtherOrgsOpen] = useState(false);

  return (
    <>
      {/* Карточка места приёма */}
      {authed ? (
        <div className="border-b border-border/15 px-3 py-2">
          {activeOrg != null ? (
            mode === "drawer" ? (
              <DrawerClose asChild>
                <BusinessActiveOrganizationContextCard
                  organization={activeOrg}
                  className="rounded-xl bg-primary/6"
                />
              </DrawerClose>
            ) : (
              <BusinessActiveOrganizationContextCard
                organization={activeOrg}
                className="rounded-xl bg-primary/6"
              />
            )
          ) : mode === "drawer" ? (
            <DrawerClose asChild>
              <Link
                href="/business/organizations"
                title={tNav("configureWorkplaceLinkAria")}
                aria-label={tNav("configureWorkplaceLinkAria")}
                className={cn(motion.interactivePressStrong, "flex min-h-11 w-full min-w-0 max-w-full items-center gap-2 rounded-xl bg-primary/6 px-3 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50")}
              >
                <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted/40" aria-hidden>
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <Plus className="size-5" strokeWidth={2} aria-hidden />
                  </div>
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[0.65rem] leading-none font-medium text-muted-foreground">{tCard("label")}</p>
                  <p className="mt-0.5 truncate text-xs font-semibold leading-tight tracking-tight text-foreground">
                    {tNav("configureWorkplaceCta")}
                  </p>
                </div>
              </Link>
            </DrawerClose>
          ) : (
            <Link
              href="/business/organizations"
              title={tNav("configureWorkplaceLinkAria")}
              aria-label={tNav("configureWorkplaceLinkAria")}
              className={cn(motion.interactivePressStrong, "flex min-h-11 w-full min-w-0 max-w-full items-center gap-2 rounded-xl bg-primary/6 px-3 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50")}
            >
              <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted/40" aria-hidden>
                <div className="flex size-full items-center justify-center text-muted-foreground">
                  <Plus className="size-5" strokeWidth={2} aria-hidden />
                </div>
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-[0.65rem] leading-none font-medium text-muted-foreground">{tCard("label")}</p>
                <p className="mt-0.5 truncate text-xs font-semibold leading-tight tracking-tight text-foreground">
                  {tNav("configureWorkplaceCta")}
                </p>
              </div>
            </Link>
          )}
        </div>
      ) : null}

      {/* Навигация */}
      <nav
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        aria-label={tNav("barLabel")}
      >
        <section className="space-y-0.5">
          <NavRows items={MAIN_NAV} activeId={activeId} tNav={tNav} mode={mode} />
        </section>

        {authed && otherOrgs.length > 0 ? (
          <section className="mt-4 border-t border-border/15 pt-3">
            <Collapsible open={otherOrgsOpen} onOpenChange={setOtherOrgsOpen}>
              <CollapsibleTrigger
                type="button"
                className={cn(motion.interactive, "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase")}
              >
                <span>{tNav("drawerOtherOrganizations")}</span>
                <ChevronDown className={cn("size-4 shrink-0 transition-transform", otherOrgsOpen && "rotate-180")} aria-hidden />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-1 pb-2">
                <ul className="flex flex-col gap-1" role="list">
                  {otherOrgs.map((org) => {
                    const name = displayNameForCabinetOrganization(org);
                    const draft = org.salonCabinetPreview;
                    const cover =
                      draft?.coverImageUrl != null
                        ? previewSrcForPersistedGalleryUrl(draft.coverImageUrl)
                        : org.publishedCoverImageUrl != null
                          ? previewSrcForPersistedGalleryUrl(org.publishedCoverImageUrl)
                          : null;
                    const orgLink = (
                      <Link
                        href={`/business/organizations/${org.id}`}
                        className={cn(motion.interactive, "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[0.8125rem] hover:bg-muted/35")}
                      >
                        <div className="size-9 shrink-0 overflow-hidden rounded-lg bg-muted/50">
                          {cover != null ? (
                            // eslint-disable-next-line @next/next/no-img-element -- URL из аплоада
                            <img src={cover} alt="" className="size-full object-cover" />
                          ) : (
                            <div className="flex size-full items-center justify-center text-muted-foreground">
                              <Building2 className="size-4 opacity-50" aria-hidden />
                            </div>
                          )}
                        </div>
                        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{name}</span>
                      </Link>
                    );
                    return (
                      <li key={org.id}>
                        {mode === "drawer" ? (
                          <DrawerClose asChild>{orgLink}</DrawerClose>
                        ) : orgLink}
                      </li>
                    );
                  })}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          </section>
        ) : null}
      </nav>
    </>
  );
}

/** Плейсхолдер той же ширины, что и сайдбар (десктоп), пока грузятся сессия или онбординг — контент не расширяется на весь экран. */
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
  const displayName = user?.name?.trim() || user?.email?.split("@")[0] || tNav("drawerGuestName");
  const displaySrc = user?.image ?? undefined;
  const displayFallback = user ? initialsFromUser(user) : "?";

  return (
    <aside className="sticky top-0 flex h-screen w-[min(calc(100vw-0.5rem),16rem)] shrink-0 flex-col overflow-hidden border-r border-border/30 bg-card md:w-64 lg:w-80">
      <div className="border-b border-border/15 px-4 pt-4 pb-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <UserAvatar src={displaySrc} alt={displayName} fallback={displayFallback} size="lg" />
          <div className="min-w-0">
            <p className="font-heading text-base font-semibold tracking-tight text-foreground">{displayName}</p>
            <p className="text-xs text-muted-foreground">
              {authed ? tNav("drawerAccountSubtitle") : tNav("drawerGuestSubtitle")}
            </p>
          </div>
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
  const displayName = user?.name?.trim() || user?.email?.split("@")[0] || tNav("drawerGuestName");
  const displaySrc = user?.image ?? undefined;
  const displayFallback = user ? initialsFromUser(user) : "?";

  return (
    <Drawer direction="left">
      <DrawerTrigger asChild>
        {/* На десктопе кнопка скрыта — сайдбар всегда в потоке */}
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
          <Menu className="size-[1.15rem] text-muted-foreground" strokeWidth={2} aria-hidden />
        </Button>
      </DrawerTrigger>
      <DrawerContent
        className="flex h-full min-h-0 max-h-[min(100dvh,100vh)] !w-[min(calc(100vw-0.5rem),16rem)] max-w-[85vw] flex-col overflow-hidden rounded-none rounded-r-2xl border-y-0 border-l-0 border-r border-border/30 bg-card pt-0 shadow-[4px_0_28px_-8px_rgba(0,0,0,0.12)]"
      >
        <DrawerHeader className="space-y-0 border-b border-border/15 px-4 pt-4 pb-3 text-left">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <UserAvatar src={displaySrc} alt={displayName} fallback={displayFallback} size="lg" />
              <div className="min-w-0">
                <DrawerTitle className="font-heading text-base font-semibold tracking-tight text-foreground">
                  {displayName}
                </DrawerTitle>
                <DrawerDescription className="text-xs text-muted-foreground">
                  {authed ? tNav("drawerAccountSubtitle") : tNav("drawerGuestSubtitle")}
                </DrawerDescription>
              </div>
            </div>
            <DrawerClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 rounded-full"
                aria-label={tNav("drawerCloseAria")}
              >
                <X className="size-[1.125rem] text-muted-foreground" strokeWidth={2} aria-hidden />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>
        <BusinessCabinetNavPanelContent mode="drawer" />
      </DrawerContent>
    </Drawer>
  );
}
