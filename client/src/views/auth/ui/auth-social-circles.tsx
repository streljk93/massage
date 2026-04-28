"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/app/i18n/navigation";
import type { OAuthEnvFlags } from "@/auth/oauth-env";
import { signInViaBackendOauth } from "@/features/auth/lib/sign-in-via-backend-oauth";
import { notify } from "@/shared/lib/notifications/notify";
import { Button } from "@/shared/ui/button";
import { cn, motion } from "@/shared/lib";

/** GSI: `?hl=` задаёт язык виджета; иначе часто срабатывает язык браузера. */
function loadGsiClientScriptForHl(hl: string): Promise<void> {
  const src = `https://accounts.google.com/gsi/client?hl=${encodeURIComponent(hl)}`;
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    );
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("script")), {
        once: true,
      });
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => {
      s.dataset.loaded = "true";
      resolve();
    };
    s.onerror = () => reject(new Error("script"));
    document.head.appendChild(s);
  });
}

function appLocaleToGsiHl(appLocale: string): string {
  if (appLocale === "ru" || appLocale === "vi") {
    return appLocale;
  }
  return "en";
}

function appLocaleToGsiButtonLocale(appLocale: string): string {
  if (appLocale === "ru") {
    return "ru_RU";
  }
  if (appLocale === "vi") {
    return "vi_VN";
  }
  return "en_US";
}

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg className={cn("size-6", className)} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export type AuthSocialCirclesProps = {
  oauth: OAuthEnvFlags;
  namespace: "authLogin" | "authRegister";
  /** Куда вести после успешного OAuth (логин и регистрация). */
  postSignInPath?: string;
};

export function AuthSocialCircles({
  oauth,
  namespace,
  postSignInPath = "/",
}: AuthSocialCirclesProps) {
  const t = useTranslations(namespace);
  const appLocale = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const googleContainerRef = useRef<HTMLDivElement>(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim() ?? "";

  const afterSignIn = useCallback(() => {
    router.push(postSignInPath);
    router.refresh();
  }, [postSignInPath, router]);

  const runOauth = useCallback(
    async (body: Parameters<typeof signInViaBackendOauth>[0]) => {
      const r = await signInViaBackendOauth(body, appLocale as "en" | "ru" | "vi");
      if (r.ok) {
        afterSignIn();
        return;
      }
      notify.error(t("errorOAuthTitle"), t("errorOAuthDescription"));
    },
    [afterSignIn, appLocale, t],
  );

  const runOauthRef = useRef(runOauth);
  useEffect(() => {
    runOauthRef.current = runOauth;
  }, [runOauth]);

  useEffect(() => {
    if (!oauth.google || !googleClientId || !googleContainerRef.current) {
      return;
    }
    let cancelled = false;
    const gsiHl = appLocaleToGsiHl(appLocale);
    void (async () => {
      try {
        await loadGsiClientScriptForHl(gsiHl);
        if (cancelled || !googleContainerRef.current) {
          return;
        }
        const g = window.google;
        if (!g?.accounts?.id) {
          return;
        }
        g.accounts.id.initialize({
          client_id: googleClientId,
          callback: (res) => {
            const credential = res?.credential;
            if (!credential) {
              return;
            }
            setPending(true);
            void (async () => {
              try {
                await runOauthRef.current({ provider: "google", idToken: credential });
              } finally {
                setPending(false);
              }
            })();
          },
        });
        const render = () => {
          if (cancelled || !googleContainerRef.current) {
            return;
          }
          const el = googleContainerRef.current;
          el.innerHTML = "";
          const w = el.getBoundingClientRect().width;
          const widthPx = w > 0 ? Math.min(400, Math.floor(w)) : 300;
          g.accounts.id.renderButton(el, {
            type: "standard",
            theme: "outline",
            size: "large",
            text: namespace === "authRegister" ? "signup_with" : "signin_with",
            shape: "pill",
            width: widthPx,
            locale: appLocaleToGsiButtonLocale(appLocale),
          });
        };
        requestAnimationFrame(() => {
          requestAnimationFrame(render);
        });
      } catch {
        /* empty */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appLocale, namespace, oauth.google, googleClientId]);

  return (
    <div className="w-full" role="group" aria-label={t("socialAria")}>
      <div
        className={cn(
          motion.interactivePressStrong,
          "w-full",
          !oauth.google || !googleClientId ? "pointer-events-none opacity-40" : "",
          pending ? "opacity-40" : "",
        )}
        aria-busy={pending}
      >
        {oauth.google && googleClientId ? (
          <div
            ref={googleContainerRef}
            className="flex h-12 w-full min-w-0 items-center justify-center"
            aria-label={t("oauthGoogle")}
          />
        ) : (
          <Button
            type="button"
            disabled
            variant="secondary"
            tone="light"
            className="h-12 w-full gap-2 rounded-2xl border border-border/60 font-medium"
            aria-label={t("oauthGoogleCta")}
          >
            <GoogleGlyph className="size-5 shrink-0" />
            {t("oauthGoogleCta")}
          </Button>
        )}
        {pending ? (
          <p className="sr-only" role="status">
            {t("oauthPending")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
