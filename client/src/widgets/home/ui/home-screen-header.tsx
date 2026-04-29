"use client";

import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/app/i18n/navigation";
import type { AppLocale } from "@/app/i18n/routing";
import { hasSpecialistAccount } from "@/entities/business";
import { UserAvatar } from "@/shared/ui";
import { cn, motion } from "@/shared/lib";
import { localeFlagEmoji } from "../lib/locale-flag";
import { createBrowserSdkClient, specialistsCabinetGetSpecialistOnboarding } from "@/shared/api";
import { useQuery } from "@tanstack/react-query";
import { BusinessCabinetEntryLink } from "./business-cabinet-entry-link";

const SPECIALIST_ONBOARDING_QUERY_KEY = ["specialistOnboarding"] as const;

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

export type HomeScreenHeaderProps = {
  /** При `titleVariant: "section"` всегда показывается этот заголовок. */
  title: string;
  /**
   * `greeting` — экран главной: без сессии — приветствие без имени; с сессией — с именем.
   * `section` — заголовок раздела (поиск, записи, профиль): всегда `title`.
   */
  titleVariant?: "greeting" | "section";
  /** Если `false`, блок с `<h1>` не рендерится (заголовок страницы ниже в контенте). */
  showHeadline?: boolean;
  avatarAlt: string;
  avatarFallback: string;
  className?: string;
};

export function HomeScreenHeader({
  title,
  titleVariant = "section",
  showHeadline = true,
  avatarAlt,
  avatarFallback,
  className,
}: HomeScreenHeaderProps) {
  const tHeader = useTranslations("homeScreenHeader");
  const tLocale = useTranslations("locale");
  const locale = useLocale() as AppLocale;
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken ?? "";

  const isAuthed = status === "authenticated" && !!session?.user;

  const { data: specialistOnboarding, isFetched: onboardingFetched } = useQuery({
    queryKey: [...SPECIALIST_ONBOARDING_QUERY_KEY, accessToken, locale],
    staleTime: 60_000,
    enabled:
      status === "authenticated" && accessToken.length > 0,
    queryFn: async () => {
      const { data, error } = await specialistsCabinetGetSpecialistOnboarding({
        client: createBrowserSdkClient(accessToken, { locale }),
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
  const profileHref = isAuthed ? "/profile" : "/login";
  const avatarAria = isAuthed
    ? tHeader("avatarLinkAria")
    : tHeader("avatarLinkLoginAria");

  const user = session?.user;
  const displaySrc =
    isAuthed && user?.image ? user.image : undefined;
  /** Без сессии — дефолтный аватар; с сессией — фото OAuth или инициалы */
  const displayAlt = isAuthed
    ? user?.name?.trim() || user?.email || avatarAlt
    : tHeader("guestWelcome");
  const displayFallback = isAuthed
    ? user
      ? initialsFromUser(user)
      : avatarFallback
    : "?";

  let headline = title;
  if (titleVariant === "greeting") {
    if (status === "loading") {
      headline = tHeader("guestWelcome");
    } else if (!isAuthed) {
      headline = tHeader("guestWelcome");
    } else {
      const name =
        user?.name?.trim() ||
        user?.email?.split("@")[0] ||
        tHeader("guestWelcome");
      headline = tHeader("welcomeWithName", { name });
    }
  }

  const headerNavLinkClass = cn(
    motion.interactivePress,
    "shrink-0 whitespace-nowrap text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline",
  );

  const specialistNavLinkBusy =
    status === "loading" ||
    (!!accessToken && isAuthed && !onboardingFetched);

  return (
    <header
      className={cn("flex items-start justify-between gap-3", className)}
    >
      <div
        className={cn("min-w-0 flex-1", showHeadline && "space-y-1")}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {specialistNavLinkBusy ? (
            <span
              role="status"
              aria-busy="true"
              className="inline-block h-9 w-[9rem] max-w-[70vw] shrink-0 rounded-full bg-neutral-950/10 animate-pulse dark:bg-white/10"
            />
          ) : specialistAccountExists ? (
            <BusinessCabinetEntryLink
              variant="headerChip"
              label={tHeader("businessCabinetLink")}
            />
          ) : (
            <Link href="/become-specialist" className={headerNavLinkClass}>
              {tHeader("becomeSpecialistLink")}
            </Link>
          )}
        </div>
        {showHeadline ? (
          <h1 className="font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {headline}
          </h1>
        ) : null}
      </div>
      <div className="relative shrink-0 self-start">
        <span
          className="pointer-events-none absolute -top-2 -right-2 z-10 text-lg leading-none select-none"
          role="img"
          aria-label={tLocale(`language.${locale}`)}
        >
          {localeFlagEmoji[locale]}
        </span>
        <Link
          href={profileHref}
          aria-label={avatarAria}
          className={cn(
            motion.interactivePressStrong,
            "relative z-0 block rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          )}
        >
          <UserAvatar
            src={displaySrc}
            alt={displayAlt}
            fallback={displayFallback}
            size="lg"
          />
        </Link>
      </div>
    </header>
  );
}
