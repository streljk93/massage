"use client";

import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link } from "@/app/i18n/navigation";
import { Separator, UserAvatar } from "@/shared/ui";
import { cn, motion } from "@/shared/lib";
import { LocaleSwitcher } from "./locale-switcher";

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
  avatarAlt: string;
  avatarFallback: string;
  className?: string;
};

export function HomeScreenHeader({
  title,
  titleVariant = "section",
  avatarAlt,
  avatarFallback,
  className,
}: HomeScreenHeaderProps) {
  const tHeader = useTranslations("homeScreenHeader");
  const { data: session, status } = useSession();

  const isAuthed = status === "authenticated" && !!session?.user;
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

  return (
    <header
      className={cn("flex items-start justify-between gap-3", className)}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <LocaleSwitcher className="shrink-0" />
          <span
            className="inline-flex h-8 shrink-0 items-center justify-center"
            aria-hidden
          >
            <Separator
              orientation="vertical"
              decorative
              className="h-3.5 bg-muted-foreground/35 dark:bg-muted-foreground/45"
            />
          </span>
          <Link
            href="/become-specialist"
            className={cn(
              motion.interactivePress,
              "shrink-0 whitespace-nowrap text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline",
            )}
          >
            {tHeader("becomeSpecialistLink")}
          </Link>
        </div>
        <h1 className="font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {headline}
        </h1>
      </div>
      <Link
        href={profileHref}
        aria-label={avatarAria}
        className={cn(
          motion.interactivePressStrong,
          "shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        )}
      >
        <UserAvatar
          src={displaySrc}
          alt={displayAlt}
          fallback={displayFallback}
          size="lg"
        />
      </Link>
    </header>
  );
}
