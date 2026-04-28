"use client";

import { ArrowLeft } from "lucide-react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/app/i18n/navigation";
import type { AppLocale } from "@/app/i18n/routing";
import { Button, UserAvatar } from "@/shared/ui";
import { cn, motion } from "@/shared/lib";
import { localeFlagEmoji } from "@/shared/lib";
import { BusinessCabinetNavDrawerTrigger } from "./business-cabinet-nav-drawer";
import { useCabinetHeaderLeadRole } from "./business-cabinet-nav-context";

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

/** Скелет под кнопку меню во время загрузки — та же метрика, без «назад». */
function CabinetMenuLeadSkeleton() {
  return (
    <div
      className="size-9 shrink-0 rounded-full border border-border/40 bg-muted/45 animate-pulse"
      aria-hidden
    />
  );
}

export type BusinessScreenHeaderProps = {
  title: string;
  titleVariant?: "greeting" | "section";
  /** Сохраняется для совместимости; заголовок страницы всегда в строке рядом с меню */
  showHeadline?: boolean;
  avatarAlt: string;
  avatarFallback: string;
  className?: string;
};

/**
 * Шапка кабинета: слева — меню (или скелет при загрузке) / для гостя «назад в приложение»,
 * рядом — заголовок страницы. «Назад» для авторизованных только внутри дровера.
 */
export function BusinessScreenHeader({
  title,
  titleVariant = "section",
  showHeadline = true,
  avatarAlt,
  avatarFallback,
  className,
}: BusinessScreenHeaderProps) {
  const tBiz = useTranslations("businessScreenHeader");
  const tHome = useTranslations("homeScreenHeader");
  const tLocale = useTranslations("locale");
  const locale = useLocale() as AppLocale;
  const { data: session, status } = useSession();
  const leadRole = useCabinetHeaderLeadRole();

  const isAuthed = status === "authenticated" && !!session?.user;
  const profileHref = isAuthed ? "/profile" : "/login";
  const avatarAria = isAuthed
    ? tHome("avatarLinkAria")
    : tHome("avatarLinkLoginAria");

  const user = session?.user;
  const displaySrc = isAuthed && user?.image ? user.image : undefined;
  const displayAlt = isAuthed
    ? user?.name?.trim() || user?.email || avatarAlt
    : tHome("guestWelcome");
  const displayFallback = isAuthed
    ? user
      ? initialsFromUser(user)
      : avatarFallback
    : "?";

  let headline = title;
  if (titleVariant === "greeting") {
    if (status === "loading") {
      headline = tHome("guestWelcome");
    } else if (!isAuthed) {
      headline = tHome("guestWelcome");
    } else {
      const name =
        user?.name?.trim() ||
        user?.email?.split("@")[0] ||
        tHome("guestWelcome");
      headline = tHome("welcomeWithName", { name });
    }
  }

  const inlineToolbarTitle =
    titleVariant === "section" || showHeadline;

  return (
    <header className={cn("flex items-center justify-between gap-3", className)}>
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <div className="flex shrink-0 items-center">
          {leadRole === "menu" ? <BusinessCabinetNavDrawerTrigger /> : null}
          {leadRole === "menuPending" ? <CabinetMenuLeadSkeleton /> : null}
          {leadRole === "back" ? (
            <Button
              variant="secondary"
              tone="light"
              asChild
              className={cn(
                motion.interactivePress,
                "h-9 min-h-9 max-h-9 shrink-0 gap-1.5 rounded-full border border-border/60 px-3 py-0 text-xs font-medium leading-none",
              )}
            >
              <Link
                href="/"
                className="inline-flex h-full min-w-0 max-w-full items-center justify-center gap-1.5"
                title={tBiz("backToAppAria")}
              >
                <ArrowLeft
                  className="size-4 shrink-0 opacity-80"
                  strokeWidth={2.25}
                  aria-hidden
                />
                <span className="truncate">{tBiz("backToApp")}</span>
              </Link>
            </Button>
          ) : null}
        </div>
        {inlineToolbarTitle ? (
          <h1
            className={cn(
              "min-w-0 flex-1 text-pretty font-heading font-bold tracking-tight text-foreground",
              titleVariant === "greeting" &&
                "text-base leading-snug sm:text-lg",
              titleVariant === "section" &&
                "text-xl leading-tight sm:text-2xl",
            )}
          >
            {headline}
          </h1>
        ) : null}
      </div>
      <div className="relative shrink-0">
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
