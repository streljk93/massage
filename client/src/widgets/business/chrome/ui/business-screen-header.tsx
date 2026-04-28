"use client";

import { ArrowLeft } from "lucide-react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/app/i18n/navigation";
import type { AppLocale } from "@/app/i18n/routing";
import { Button, UserAvatar } from "@/shared/ui";
import { cn, motion } from "@/shared/lib";
import { localeFlagEmoji } from "@/shared/lib";

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

export type BusinessScreenHeaderProps = {
  title: string;
  titleVariant?: "greeting" | "section";
  showHeadline?: boolean;
  avatarAlt: string;
  avatarFallback: string;
  className?: string;
};

/**
 * Шапка кабинета бизнеса: кнопка «обратно в приложение» на главную, без «Стать специалистом».
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

  return (
    <header
      className={cn("flex items-start justify-between gap-3", className)}
    >
      <div className={cn("min-w-0 flex-1", showHeadline && "space-y-1")}>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <Button
            variant="secondary"
            tone="light"
            asChild
            className={cn(
              motion.interactivePress,
              "h-10 min-h-10 max-h-10 max-w-full shrink-0 gap-1.5 rounded-full border border-border/60 px-3 py-0 text-xs font-medium leading-none",
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
