"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/app/i18n/navigation";
import type { OAuthEnvFlags } from "@/auth/oauth-env";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { cn, motion, registrationHrefWithReturn } from "@/shared/lib";
import { AuthSocialCircles } from "./auth-social-circles";

const authFieldClass =
  "h-12 rounded-2xl border border-border/60 bg-card px-4 text-foreground shadow-none ring-offset-background placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40";

export type LoginPageProps = {
  oauth: OAuthEnvFlags;
  /** Куда вести после успешного входа (email и OAuth). */
  postSignInPath?: string;
};

export function LoginPage({ oauth, postSignInPath = "/" }: LoginPageProps) {
  const t = useTranslations("authLogin");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("credentials");
        return;
      }
      if (res?.ok) {
        router.push(postSignInPath);
        router.refresh();
      }
    } catch {
      setError("generic");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/25 px-4 py-10">
      <div className="relative w-full max-w-[22rem] rounded-[2rem] border border-border/50 bg-card p-6 sm:p-8">
        <div className="mb-6">
          <h1 className="text-center text-lg font-medium tracking-tight text-foreground">
            {t("title")}
          </h1>
        </div>

        <form onSubmit={(e) => void onCredentials(e)} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="email"
              name="email"
              autoComplete="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={authFieldClass}
            />
          </div>
          <div className="space-y-2">
            <Input
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder={t("passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={authFieldClass}
            />
            <div className="flex justify-end">
              <button
                type="button"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("forgotPassword")}
              </button>
            </div>
          </div>
          {error === "credentials" ? (
            <p className="text-center text-sm text-destructive" role="alert">
              {t("errorCredentials")}
            </p>
          ) : null}
          {error === "generic" ? (
            <p className="text-center text-sm text-destructive" role="alert">
              {t("errorGeneric")}
            </p>
          ) : null}
          <div className="flex flex-col gap-3">
            <Button
              type="submit"
              disabled={pending}
              className={cn(
                motion.interactivePressStrong,
                "h-12 w-full rounded-2xl border-0 bg-foreground text-base font-medium text-background hover:bg-foreground/90",
              )}
            >
              {t("submit")}
            </Button>
            <AuthSocialCircles
              oauth={oauth}
              namespace="authLogin"
              postSignInPath={postSignInPath}
            />
          </div>
        </form>

        <div className="mt-8">
          <Button
            variant="secondary"
            tone="light"
            className={cn(
              motion.interactivePressStrong,
              "h-12 w-full rounded-2xl border border-border/60 bg-background font-medium text-foreground hover:bg-muted/50",
            )}
            asChild
          >
            <Link href={registrationHrefWithReturn(postSignInPath)}>
              {t("registrationCta")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
