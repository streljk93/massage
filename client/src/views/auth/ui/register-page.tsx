"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/app/i18n/navigation";
import type { OAuthEnvFlags } from "@/auth/oauth-env";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { cn, motion } from "@/shared/lib";
import { AuthSocialCircles } from "./auth-social-circles";

const authFieldClass =
  "h-12 rounded-2xl border border-border/60 bg-card px-4 text-foreground shadow-none ring-offset-background placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40";

export type RegisterPageProps = {
  oauth: OAuthEnvFlags;
};

export function RegisterPage({ oauth }: RegisterPageProps) {
  const t = useTranslations("authRegister");
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    setPending(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        name,
        redirect: false,
      });
      if (res?.error) {
        setError(true);
        return;
      }
      if (res?.ok) {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError(true);
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

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <Input
            type="text"
            name="name"
            autoComplete="name"
            placeholder={t("namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={authFieldClass}
          />
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
          <Input
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder={t("passwordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className={authFieldClass}
          />
          {error ? (
            <p className="text-center text-sm text-destructive" role="alert">
              {t("errorGeneric")}
            </p>
          ) : null}
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
        </form>

        <div className="mt-8">
          <AuthSocialCircles oauth={oauth} namespace="authRegister" />
        </div>

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
            <Link href="/login">{t("loginCta")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
