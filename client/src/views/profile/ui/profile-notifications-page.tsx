"use client";

import { startTransition, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/app/i18n/routing";
import {
  createBrowserSdkClient,
  usersMe,
  usersPatchMe,
} from "@/shared/api";
import { Button } from "@/shared/ui/button";
import { Switch } from "@/shared/ui";
import { ProfileSubpageShell } from "./profile-subpage-shell";

type ToggleId = "booking" | "promo" | "email";

const LEAD_OPTIONS = [15, 30, 60] as const;
type LeadMin = (typeof LEAD_OPTIONS)[number];

type LoadState = "idle" | "loading" | "ready" | "error" | "demo";

function leadLabelKey(m: LeadMin): "lead15" | "lead30" | "lead60" {
  if (m === 15) {
    return "lead15";
  }
  if (m === 30) {
    return "lead30";
  }
  return "lead60";
}

export function ProfileNotificationsPage() {
  const t = useTranslations("profileNotifications");
  const locale = useLocale() as AppLocale;
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken;

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [bookingEnabled, setBookingEnabled] = useState(false);
  const [leadMinutes, setLeadMinutes] = useState<LeadMin>(30);
  const [on, setOn] = useState<Record<"promo" | "email", boolean>>({
    promo: false,
    email: true,
  });
  const [savingBooking, setSavingBooking] = useState(false);

  useEffect(() => {
    if (status === "loading") {
      return;
    }
    if (!accessToken) {
      startTransition(() => {
        setLoadState("demo");
        setBookingEnabled(true);
        setLeadMinutes(30);
      });
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadState("loading");
      const client = createBrowserSdkClient(accessToken, { locale });
      const res = await usersMe({ client });
      if (cancelled) {
        return;
      }
      if (res.error || !res.data) {
        setLoadState("error");
        return;
      }
      const d = res.data;
      setBookingEnabled(d.bookingReminderEnabled);
      const l = d.bookingReminderLeadMinutes;
      setLeadMinutes(l === 15 || l === 30 || l === 60 ? l : 30);
      setLoadState("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, locale, status]);

  const patchBooking = async (body: {
    bookingReminderEnabled?: boolean;
    bookingReminderLeadMinutes?: LeadMin;
  }) => {
    if (!accessToken || loadState !== "ready") {
      return;
    }
    setSavingBooking(true);
    try {
      const client = createBrowserSdkClient(accessToken, { locale });
      const res = await usersPatchMe({
        client,
        body,
      });
      if (!res.error && res.data) {
        setBookingEnabled(res.data.bookingReminderEnabled);
        const l = res.data.bookingReminderLeadMinutes;
        setLeadMinutes(l === 15 || l === 30 || l === 60 ? l : 30);
      }
    } finally {
      setSavingBooking(false);
    }
  };

  const rows: {
    id: ToggleId;
    titleKey: "bookingTitle" | "promoTitle" | "emailTitle";
    descKey: "bookingDescription" | "promoDescription" | "emailDescription";
    apiBacked?: boolean;
  }[] = [
    {
      id: "booking",
      titleKey: "bookingTitle",
      descKey: "bookingDescription",
      apiBacked: true,
    },
    {
      id: "promo",
      titleKey: "promoTitle",
      descKey: "promoDescription",
    },
    {
      id: "email",
      titleKey: "emailTitle",
      descKey: "emailDescription",
    },
  ];

  return (
    <ProfileSubpageShell title={t("title")}>
      {loadState === "error" ? (
        <p className="rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm text-destructive">
          {t("loadError")}
        </p>
      ) : null}
      <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card">
        {rows.map((row) => {
          const enabled =
            row.id === "booking"
              ? bookingEnabled
              : row.id === "promo"
                ? on.promo
                : on.email;
          return (
            <li key={row.id}>
              <div className="flex items-start gap-3 px-4 py-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {t(row.titleKey)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(row.descKey)}
                  </p>
                </div>
                <Switch
                  checked={enabled}
                  disabled={
                    row.apiBacked === true &&
                    (loadState === "loading" || savingBooking)
                  }
                  onCheckedChange={(v) => {
                    if (row.id === "booking" && row.apiBacked) {
                      if (loadState === "ready" && accessToken) {
                        void patchBooking({ bookingReminderEnabled: v });
                      } else {
                        setBookingEnabled(v);
                      }
                      return;
                    }
                    if (row.id === "promo") {
                      setOn((p) => ({ ...p, promo: v }));
                      return;
                    }
                    setOn((p) => ({ ...p, email: v }));
                  }}
                  aria-label={`${t(row.titleKey)}: ${enabled ? t("on") : t("off")}`}
                />
              </div>
              {row.id === "booking" && enabled ? (
                <div className="space-y-2 border-t border-border/40 bg-muted/20 px-4 py-3">
                  <p className="text-xs font-medium text-foreground">
                    {t("reminderLeadLabel")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {LEAD_OPTIONS.map((m) => {
                      const active = leadMinutes === m;
                      return (
                        <Button
                          key={m}
                          type="button"
                          size="sm"
                          variant={active ? "primary" : "secondary"}
                          tone={active ? undefined : "light"}
                          disabled={
                            row.apiBacked === true &&
                            (loadState === "loading" || savingBooking)
                          }
                          className="rounded-xl"
                          onClick={() => {
                            if (m === leadMinutes) {
                              return;
                            }
                            setLeadMinutes(m);
                            if (row.apiBacked && loadState === "ready" && accessToken) {
                              void patchBooking({
                                bookingReminderLeadMinutes: m,
                              });
                            }
                          }}
                        >
                          {t(leadLabelKey(m))}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </ProfileSubpageShell>
  );
}
