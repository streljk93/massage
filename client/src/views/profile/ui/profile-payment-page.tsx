"use client";

import { Banknote, CreditCard } from "lucide-react";
import { useTranslations } from "next-intl";
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
          {profilePaymentMethodsMock.map((row) => {
            const isCash = row.kind === "cash";
            return (
              <li
                key={row.id}
                className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3.5"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                  {isCash ? (
                    <Banknote
                      className="size-5 text-muted-foreground"
                      aria-hidden
                    />
                  ) : (
                    <CreditCard
                      className="size-5 text-muted-foreground"
                      aria-hidden
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {isCash ? (
                        t("demoCash")
                      ) : (
                        <>
                          {t(row.brandKey)} · ···· {row.last4}
                        </>
                      )}
                    </p>
                    {row.isDefault ? (
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                        {t("defaultBadge")}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isCash ? t("cashHint") : t("expires", { month: row.expMonth, year: row.expYear })}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        <Button
          type="button"
          variant="secondary"
          tone="light"
          className={cn(
            motion.interactivePressStrong,
            "w-full rounded-xl border border-dashed border-border/80 py-6",
          )}
        >
          {t("addMethod")}
        </Button>
      </div>
    </ProfileSubpageShell>
  );
}
