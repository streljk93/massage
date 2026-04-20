"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ProfileSubpageShell } from "./profile-subpage-shell";
import { SUPPORT_EMAIL } from "../lib/support-contact";
import { Button } from "@/shared/ui/button";
import { cn, motion } from "@/shared/lib";

export function ProfileHelpPage() {
  const t = useTranslations("profileHelp");
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <ProfileSubpageShell title={t("title")}>
      <div className="space-y-8">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("intro")}
        </p>

        <section className="space-y-3">
          <h2 className="font-heading text-base font-semibold text-foreground">
            {t("contactHeading")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("contactBody")}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="break-all text-sm font-medium text-foreground">
              {SUPPORT_EMAIL}
            </span>
            <Button
              type="button"
              variant="secondary"
              tone="light"
              className={cn(motion.interactivePressStrong, "shrink-0 rounded-xl")}
              onClick={() => void onCopy()}
            >
              {copied ? t("emailCopied") : t("emailAction")}
            </Button>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-heading text-base font-semibold text-foreground">
            {t("faqHeading")}
          </h2>
          <div className="space-y-4 rounded-2xl border border-border/60 bg-card px-4 py-4">
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">
                {t("faq1q")}
              </p>
              <p className="text-sm text-muted-foreground">{t("faq1a")}</p>
            </div>
            <div className="border-t border-border/50 pt-4">
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-foreground">
                  {t("faq2q")}
                </p>
                <p className="text-sm text-muted-foreground">{t("faq2a")}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </ProfileSubpageShell>
  );
}
