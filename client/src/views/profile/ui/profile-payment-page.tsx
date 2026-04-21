"use client";

import { Banknote } from "lucide-react";
import { useTranslations } from "next-intl";
import { openComingSoon } from "@/features/coming-soon";
import { ProfileSubpageShell } from "./profile-subpage-shell";
import { profilePaymentMethodsMock } from "../lib/mock-payment-methods";
import { Button } from "@/shared/ui/button";
import { cn, motion } from "@/shared/lib";

export function ProfilePaymentPage() {
  const t = useTranslations("profilePayment");

  return (
    <ProfileSubpageShell title={t("title")}>
      <div className="space-y-3">
        <ul className="space-y-2">
          {profilePaymentMethodsMock.map((row) => (
            <li
              key={row.id}
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-4 py-3.5",
                row.isDefault ?
                  "border-primary/45 bg-primary/5 ring-1 ring-primary/20"
                : "border-border/60 bg-card",
              )}
            >
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  row.isDefault ? "bg-primary/10" : "bg-muted",
                )}
              >
                <Banknote
                  className={cn(
                    "size-5",
                    row.isDefault ?
                      "text-primary"
                    : "text-muted-foreground",
                  )}
                  aria-hidden
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {t("demoCash")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("cashHint")}
                </p>
              </div>
              {row.isDefault ?
                <span className="shrink-0 rounded-md bg-primary/15 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-primary">
                  {t("selectedBadge")}
                </span>
              : null}
            </li>
          ))}
        </ul>

        <Button
          type="button"
          variant="secondary"
          tone="light"
          className={cn(
            motion.interactivePressStrong,
            "w-full rounded-xl border border-dashed border-border/80 py-6",
          )}
          onClick={() => openComingSoon()}
        >
          {t("addMethod")}
        </Button>
      </div>
    </ProfileSubpageShell>
  );
}
