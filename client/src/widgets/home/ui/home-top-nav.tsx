"use client";

import { Bell, Heart, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/app/i18n/navigation";
import type { AppLocale } from "@/app/i18n/routing";
import { hasSpecialistAccount } from "@/entities/business";
import { createBrowserSdkClient, specialistsCabinetGetSpecialistOnboarding } from "@/shared/api";
import { BrandLogo, UserAvatar } from "@/shared/ui";
import { Button } from "@/shared/ui/button";
import { cn, motion } from "@/shared/lib";
import { BusinessCabinetEntryLink } from "./business-cabinet-entry-link";

const SPECIALIST_ONBOARDING_QUERY_KEY = ["specialistOnboarding"] as const;

const navItems = [
  { id: "home", href: "/" as const, labelKey: "nav.home" as const },
  { id: "search", href: "/search" as const, labelKey: "nav.search" as const },
  {
    id: "bookings",
    href: "/bookings" as const,
    labelKey: "nav.bookings" as const,
  },
  {
    id: "profile",
    href: "/profile" as const,
    labelKey: "nav.profile" as const,
  },
] as const;

export type HomeTopNavActiveId = (typeof navItems)[number]["id"];

export type HomeTopNavProps = {
  activeId?: HomeTopNavActiveId;
  className?: string;
};

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

export function HomeTopNav({ activeId = "home", className }: HomeTopNavProps) {
  const t = useTranslations();
  const tTop = useTranslations("homeTopNav");
  const tHeader = useTranslations("homeScreenHeader");
  const locale = useLocale() as AppLocale;
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken ?? "";

  const isAuthed = status === "authenticated" && !!session?.user;

  const { data: specialistOnboarding, isFetched: onboardingFetched } = useQuery({
    queryKey: [...SPECIALIST_ONBOARDING_QUERY_KEY, accessToken, locale],
    staleTime: 60_000,
    enabled: status === "authenticated" && accessToken.length > 0,
    queryFn: async () => {
      const { data, error } = await specialistsCabinetGetSpecialistOnboarding({
        client: createBrowserSdkClient(accessToken, { locale }),
        query: { locale },
      });
      if (error || !data) {
        throw new Error("specialist onboarding");
      }
      return data;
    },
  });

  const specialistAccountExists =
    onboardingFetched &&
    specialistOnboarding != null &&
    hasSpecialistAccount(specialistOnboarding);
  const specialistNavLinkBusy =
    status === "loading" ||
    (!!accessToken && isAuthed && !onboardingFetched);

  const profileHref = isAuthed ? "/profile" : "/login";
  const avatarAria = isAuthed
    ? tTop("avatarLinkAria")
    : tTop("avatarLinkLoginAria");
  const user = session?.user;
  const displaySrc = isAuthed && user?.image ? user.image : undefined;
  const displayAlt = isAuthed
    ? user?.name?.trim() || user?.email || tTop("avatarLinkAria")
    : tTop("avatarLinkLoginAria");
  const displayFallback = isAuthed && user ? initialsFromUser(user) : "?";

  const iconButtonClass = cn(
    motion.interactivePress,
    "inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
  );

  return (
    <header
      className={cn(
        "sticky top-0 z-50 hidden border-b border-border/80 bg-background/75 backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-background/55 dark:border-border/85 dark:supports-[backdrop-filter]:bg-background/45 lg:block",
        className,
      )}
    >
      <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center gap-8 px-4 lg:px-12">
        <Link
          href="/"
          className={cn(motion.interactivePress, "shrink-0")}
          aria-label={tTop("logoLinkAria")}
        >
          <BrandLogo />
        </Link>

        <nav
          className="flex min-w-0 flex-1 items-center gap-7"
          aria-label={t("nav.mainLabel")}
        >
          {navItems.map(({ id, href, labelKey }) => {
            const active = id === activeId;
            return (
              <Link
                key={id}
                href={href}
                className={cn(
                  motion.interactivePress,
                  "shrink-0 whitespace-nowrap text-sm transition-colors",
                  active
                    ? "font-semibold text-foreground"
                    : "font-normal text-muted-foreground hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                {t(labelKey)}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          {specialistNavLinkBusy ? (
            <span
              role="status"
              aria-busy="true"
              className="inline-block h-9 w-[9.5rem] shrink-0 rounded-full bg-muted/70 animate-pulse"
            />
          ) : specialistAccountExists ? (
            <BusinessCabinetEntryLink
              variant="headerChip"
              label={tHeader("businessCabinetLink")}
            />
          ) : (
            <Button
              variant="ghost"
              className="h-9 shrink-0 rounded-full border border-border/50 bg-white/15 px-4 text-sm font-normal text-muted-foreground shadow-none transition-colors hover:bg-white/25 hover:text-foreground dark:bg-white/5 dark:hover:bg-white/10"
              asChild
            >
              <Link href="/become-specialist">{tHeader("becomeSpecialistLink")}</Link>
            </Button>
          )}
          <Button
            variant="ghost"
            tone="light"
            className={iconButtonClass}
            asChild
          >
            <Link href="/search" aria-label={tTop("searchLinkAria")}>
              <Search className="size-[1.15rem]" strokeWidth={2} aria-hidden />
            </Link>
          </Button>
          <Button
            variant="ghost"
            tone="light"
            className={iconButtonClass}
            asChild
          >
            <Link href="/profile/favorites" aria-label={tTop("favoritesLinkAria")}>
              <Heart className="size-[1.15rem]" strokeWidth={2} aria-hidden />
            </Link>
          </Button>
          <Button
            variant="ghost"
            tone="light"
            className={iconButtonClass}
            asChild
          >
            <Link
              href="/profile/notifications"
              aria-label={tTop("notificationsLinkAria")}
            >
              <Bell className="size-[1.15rem]" strokeWidth={2} aria-hidden />
            </Link>
          </Button>
          <Link
            href={profileHref}
            aria-label={avatarAria}
            className={cn(
              motion.interactivePressStrong,
              "block rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
            )}
          >
            <UserAvatar
              src={displaySrc}
              alt={displayAlt}
              fallback={displayFallback}
              size="default"
              className="size-9"
            />
          </Link>
        </div>
      </div>
    </header>
  );
}
