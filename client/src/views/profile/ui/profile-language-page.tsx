"use client";

import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "@/app/i18n/navigation";
import type { AppLocale } from "@/app/i18n/routing";
import { routing } from "@/app/i18n/routing";
import { cn, motion } from "@/shared/lib";
import { createBrowserSdkClient, usersPatchMe } from "@/shared/api";
import { ProfileSubpageShell } from "./profile-subpage-shell";

export function ProfileLanguagePage() {
  const t = useTranslations("profileLanguage");
  const tLocale = useTranslations("locale");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const accessToken = session?.accessToken;

  return (
    <ProfileSubpageShell title={t("title")} backHref="/profile">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
        <ul
          className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card"
          role="listbox"
          aria-label={t("title")}
        >
          {routing.locales.map((loc) => {
            const selected = locale === loc;
            return (
              <li key={loc} className="p-0">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={cn(
                    motion.interactivePressStrong,
                    "flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium",
                    selected
                      ? "bg-muted/50 text-foreground"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                  )}
                  onClick={() => {
                    void (async () => {
                      if (accessToken) {
                        const client = createBrowserSdkClient(accessToken, {
                          locale: loc,
                        });
                        await usersPatchMe({ client, body: { locale: loc } });
                      }
                      router.replace(pathname, { locale: loc });
                    })();
                  }}
                >
                  <span className="min-w-0 flex-1">{tLocale(`language.${loc}`)}</span>
                  {selected ? (
                    <Check
                      className="size-4 shrink-0 text-primary"
                      aria-hidden
                    />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </ProfileSubpageShell>
  );
}
