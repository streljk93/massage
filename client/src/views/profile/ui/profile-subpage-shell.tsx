"use client";

import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/app/i18n/navigation";
import { HomeBottomNav } from "@/widgets/home";
import { Button } from "@/shared/ui/button";
import { cn, goBackOrFallback } from "@/shared/lib";

export type ProfileSubpageShellProps = {
  title: string;
  children: ReactNode;
  className?: string;
  /** Явный маршрут для кнопки «назад» (без префикса локали). */
  backHref?: string;
};

export function ProfileSubpageShell({
  title,
  children,
  className,
  backHref,
}: ProfileSubpageShellProps) {
  const t = useTranslations("profileShell");
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col bg-surface-background">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-surface-background/95 pb-2 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 pt-3">
          <Button
            type="button"
            variant="ghost"
            className="size-11 shrink-0 rounded-full px-0"
            aria-label={t("backAria")}
            onClick={() => {
              if (backHref) {
                router.replace(backHref);
                return;
              }
              goBackOrFallback(router, "/profile");
            }}
          >
            <ArrowLeft className="size-5 text-foreground" aria-hidden />
          </Button>
          <h1 className="min-w-0 flex-1 font-heading text-lg font-bold tracking-tight text-foreground">
            {title}
          </h1>
        </div>
      </header>

      <div
        className={cn(
          "mx-auto w-full max-w-lg flex-1 px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-4",
          className,
        )}
      >
        {children}
      </div>

      <HomeBottomNav activeId="profile" />
    </div>
  );
}
