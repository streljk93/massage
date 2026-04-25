"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/app/i18n/navigation";
import type { OAuthEnvFlags } from "@/auth/oauth-env";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/shared/ui/shadcn/input-otp";
import { cn, motion } from "@/shared/lib";
import { AuthSocialCircles } from "./auth-social-circles";

const authFieldClass =
  "h-12 rounded-2xl border border-border/60 bg-card px-4 text-foreground shadow-none ring-offset-background placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40";

export type RegisterPageProps = {
  oauth: OAuthEnvFlags;
};

type Step = "form" | "otp";

type ApiErr = { code?: string; message?: string | { code?: string; message?: string } };

function readErrCode(data: unknown): string | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }
  const o = data as ApiErr;
  if (typeof o.code === "string") {
    return o.code;
  }
  const m = o.message;
  if (m && typeof m === "object" && "code" in m && typeof m.code === "string") {
    return m.code;
  }
  return undefined;
}

export function RegisterPage({ oauth }: RegisterPageProps) {
  const t = useTranslations("authRegister");
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<
    | false
    | "generic"
    | "taken"
    | "config"
    | "mail"
    | "invalidCode"
    | "expired"
    | "resendCreds"
  >(false);
  const [pending, setPending] = useState(false);
  const [resendPending, setResendPending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const onSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    setPending(true);
    try {
      const reg = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: name.trim(),
        }),
      });
      const data = (await reg.json().catch(() => ({}))) as {
        status?: string;
        code?: string;
      };

      if (reg.status === 503) {
        const code = readErrCode(data);
        if (code === "MAIL_NOT_CONFIGURED" || code === "MAIL_SEND_FAILED") {
          setError("mail");
        } else {
          setError("config");
        }
        return;
      }
      if (reg.status === 409) {
        setError("taken");
        return;
      }
      if (!reg.ok) {
        setError("generic");
        return;
      }
      if (data.status === "verification_required") {
        setOtp("");
        setResendSuccess(false);
        setStep("otp");
        return;
      }
      setError("generic");
    } catch {
      setError("generic");
    } finally {
      setPending(false);
    }
  };

  const onVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      return;
    }
    setResendSuccess(false);
    setError(false);
    setPending(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: otp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = readErrCode(data);
        if (code === "VERIFICATION_EXPIRED") {
          setError("expired");
        } else if (code === "INVALID_CODE" || code === "VERIFICATION_NOT_FOUND") {
          setError("invalidCode");
        } else {
          setError("generic");
        }
        return;
      }

      const sign = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });
      if (sign?.error) {
        setError("generic");
        return;
      }
      if (sign?.ok) {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("generic");
    } finally {
      setPending(false);
    }
  };

  const onResend = async () => {
    setError(false);
    setResendSuccess(false);
    setResendPending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (res.status === 401) {
        setError("resendCreds");
        return;
      }
      if (res.status === 503) {
        setError("mail");
        return;
      }
      if (res.status === 204) {
        setResendSuccess(true);
        return;
      }
      if (!res.ok) {
        setError("generic");
      }
    } catch {
      setError("generic");
    } finally {
      setResendPending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/25 px-4 py-10">
      <div className="relative w-full max-w-[22rem] rounded-[2rem] border border-border/50 bg-card p-6 sm:p-8">
        <div className="mb-6">
          <h1 className="text-center text-lg font-medium tracking-tight text-foreground">
            {step === "form" ? t("title") : t("otpTitle")}
          </h1>
          {step === "otp" ? (
            <>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {t("otpDescription")}
              </p>
              <div
                className="mt-3 rounded-2xl border border-border/60 bg-muted/40 px-3 py-2.5 text-center"
                role="status"
                aria-label={t("otpTargetLabel")}
              >
                <p className="text-xs text-muted-foreground">
                  {t("otpTargetLabel")}
                </p>
                <p className="mt-0.5 break-all text-sm font-medium text-foreground">
                  {email.trim()}
                </p>
              </div>
            </>
          ) : null}
        </div>

        {step === "form" ? (
          <form
            onSubmit={(e) => void onSubmitForm(e)}
            className="space-y-4"
            noValidate
          >
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
              minLength={8}
              className={authFieldClass}
            />
            {error === "generic" ? (
              <p className="text-center text-sm text-destructive" role="alert">
                {t("errorGeneric")}
              </p>
            ) : null}
            {error === "taken" ? (
              <p className="text-center text-sm text-destructive" role="alert">
                {t("errorEmailTaken")}
              </p>
            ) : null}
            {error === "config" ? (
              <p className="text-center text-sm text-destructive" role="alert">
                {t("errorBackendNotConfigured")}
              </p>
            ) : null}
            {error === "mail" ? (
              <p className="text-center text-sm text-destructive" role="alert">
                {t("errorMailDelivery")}
              </p>
            ) : null}
            <p className="text-center text-xs leading-snug text-muted-foreground">
              {t("submitEmailHint")}
            </p>
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
        ) : (
          <form
            onSubmit={(e) => void onVerifyOtp(e)}
            className="space-y-6"
            noValidate
          >
            {resendSuccess ? (
              <p
                className="text-center text-sm text-emerald-600 dark:text-emerald-500"
                role="status"
              >
                {t("resendSuccess")}
              </p>
            ) : null}
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={(v) => {
                  setOtp(v);
                  setResendSuccess(false);
                }}
                autoFocus
                containerClassName="gap-2"
                aria-label={t("otpAria")}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="size-10 rounded-lg" />
                  <InputOTPSlot index={1} className="size-10 rounded-lg" />
                  <InputOTPSlot index={2} className="size-10 rounded-lg" />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} className="size-10 rounded-lg" />
                  <InputOTPSlot index={4} className="size-10 rounded-lg" />
                  <InputOTPSlot index={5} className="size-10 rounded-lg" />
                </InputOTPGroup>
              </InputOTP>
            </div>
            {error === "invalidCode" ? (
              <p className="text-center text-sm text-destructive" role="alert">
                {t("errorInvalidOtp")}
              </p>
            ) : null}
            {error === "expired" ? (
              <p className="text-center text-sm text-destructive" role="alert">
                {t("errorOtpExpired")}
              </p>
            ) : null}
            {error === "resendCreds" ? (
              <p className="text-center text-sm text-destructive" role="alert">
                {t("errorResendCredentials")}
              </p>
            ) : null}
            {error === "generic" ? (
              <p className="text-center text-sm text-destructive" role="alert">
                {t("errorGeneric")}
              </p>
            ) : null}
            {error === "mail" ? (
              <p className="text-center text-sm text-destructive" role="alert">
                {t("errorMailDelivery")}
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={pending || otp.length !== 6}
              className={cn(
                motion.interactivePressStrong,
                "h-12 w-full rounded-2xl border-0 bg-foreground text-base font-medium text-background hover:bg-foreground/90",
              )}
            >
              {t("otpSubmit")}
            </Button>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="secondary"
                tone="light"
                disabled={resendPending}
                className="h-11 w-full rounded-2xl"
                onClick={() => void onResend()}
              >
                {t("resendCode")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                tone="light"
                className="h-11 w-full rounded-2xl"
                onClick={() => {
                  setStep("form");
                  setOtp("");
                  setError(false);
                  setResendSuccess(false);
                }}
              >
                {t("backToForm")}
              </Button>
            </div>
          </form>
        )}

        {step === "form" ? (
          <>
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
          </>
        ) : null}
      </div>
    </div>
  );
}
