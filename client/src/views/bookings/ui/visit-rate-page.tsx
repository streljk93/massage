"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useParams, useSearchParams } from "next/navigation";
import { useRouter } from "@/app/i18n/navigation";
import type { AppLocale } from "@/app/i18n/routing";
import {
  bookingsList,
  bookingsSubmitVisitReviews,
  createBrowserSdkClient,
} from "@/shared/api";
import {
  buildBookingsListPath,
  parseBookingsListTab,
} from "@/entities/booking";
import { notify } from "@/shared/lib/notifications";
import { AppBackButton, Button } from "@/shared/ui";
import { HomeBottomNav } from "@/widgets/home";
import { cn, motion } from "@/shared/lib";

function RatingInput({
  value,
  onChange,
  sectionId,
}: {
  value: number;
  onChange: (n: number) => void;
  sectionId: string;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-0.5"
      role="radiogroup"
      aria-labelledby={sectionId}
    >
      {Array.from({ length: 5 }, (_, i) => {
        const n = i + 1;
        const active = n <= value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            className={cn(
              motion.interactivePressStrong,
              "rounded-md p-1.5 text-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            )}
            onClick={() => {
              onChange(n);
            }}
          >
            <Star
              className={cn("size-8 sm:size-9", active ? "fill-current" : "")}
              strokeWidth={active ? 0 : 1.35}
              fill={active ? "currentColor" : "none"}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}

export function VisitRatePage() {
  const t = useTranslations("visitRate");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const params = useParams();
  const bookingId = params.id as string;
  const searchParams = useSearchParams();
  const returnBookingsPath = useMemo(
    () =>
      buildBookingsListPath(
        parseBookingsListTab(searchParams.get("bookingsTab")),
      ),
    [searchParams],
  );
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken;

  const [loadState, setLoadState] = useState<"initial" | "ok" | "err">(
    "initial",
  );
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [specialistName, setSpecialistName] = useState<string>("");

  const [orgRating, setOrgRating] = useState(0);
  const [specRating, setSpecRating] = useState(0);
  const [orgComment, setOrgComment] = useState("");
  const [specComment, setSpecComment] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);

  const canSubmit =
    orgRating >= 1 && orgRating <= 5 && specRating >= 1 && specRating <= 5;

  const load = useCallback(async () => {
    if (!accessToken) {
      return;
    }
    setLoadState("initial");
    setLoadMessage(null);
    const res = await bookingsList({
      client: createBrowserSdkClient(accessToken, { locale }),
      query: { locale },
    });
    if (res.error || !res.data) {
      setLoadState("err");
      setLoadMessage(t("errorLoad"));
      return;
    }
    const row = res.data.bookings.find((b) => b.id === bookingId);
    if (row == null) {
      setLoadState("err");
      setLoadMessage(t("errorNotFound"));
      return;
    }
    if (row.status !== "done") {
      setLoadState("err");
      setLoadMessage(t("errorNotDone"));
      return;
    }
    if (row.visitReviewComplete) {
      setLoadState("err");
      setLoadMessage(t("errorAlready"));
      return;
    }
    setOrgName(row.organizationName);
    setSpecialistName(row.specialistName);
    setLoadState("ok");
    setLoadMessage(null);
  }, [accessToken, bookingId, locale, t]);

  useEffect(() => {
    if (sessionStatus === "loading") {
      return;
    }
    if (!accessToken) {
      setLoadState("err");
      setLoadMessage(t("signInHint"));
      return;
    }
    void load();
  }, [accessToken, load, sessionStatus, t]);

  const onSubmit = async () => {
    if (!accessToken || !canSubmit || submitBusy) {
      return;
    }
    setSubmitBusy(true);
    try {
      const res = await bookingsSubmitVisitReviews({
        client: createBrowserSdkClient(accessToken, { locale }),
        path: { id: bookingId },
        body: {
          organizationRating: orgRating,
          specialistRating: specRating,
          organizationComment: orgComment.trim() || undefined,
          specialistComment: specComment.trim() || undefined,
        },
      });
      if (res.error || !res.data) {
        notify.error(t("errorGeneric"));
        return;
      }
      notify.success(t("success"));
      router.push(returnBookingsPath);
    } finally {
      setSubmitBusy(false);
    }
  };

  if (sessionStatus === "loading" || (accessToken && loadState === "initial")) {
    return (
      <div className="flex min-h-screen flex-col bg-surface-background">
        <div className="mx-auto w-full max-w-lg flex-1 px-4 pt-3 pb-28">
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        </div>
        <HomeBottomNav activeId="bookings" />
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="flex min-h-screen flex-col bg-surface-background">
        <div className="mx-auto w-full max-w-lg flex-1 space-y-3 px-4 pt-3 pb-28">
          <p className="text-sm text-muted-foreground">{t("signInHint")}</p>
        </div>
        <HomeBottomNav activeId="bookings" />
      </div>
    );
  }

  if (loadState === "err" || loadMessage != null) {
    return (
      <div className="flex min-h-screen flex-col bg-surface-background">
        <div className="mx-auto w-full max-w-lg flex-1 space-y-3 px-4 pt-3 pb-28">
          <div className="mb-2 flex items-center gap-2">
            <AppBackButton
              fallback={returnBookingsPath}
              ariaLabel={t("backAria")}
            />
          </div>
          <p className="text-sm text-destructive">
            {loadMessage ?? t("errorGeneric")}
          </p>
        </div>
        <HomeBottomNav activeId="bookings" />
      </div>
    );
  }

  const salonLabel =
    orgName != null && orgName !== ""
      ? t("sectionSalonNamed", { name: orgName })
      : t("sectionSalon");
  const specialistLabel =
    specialistName !== ""
      ? t("sectionSpecialistNamed", { name: specialistName })
      : t("sectionSpecialist");

  return (
    <div className="flex min-h-screen flex-col bg-surface-background">
      <div className="mx-auto w-full max-w-lg flex-1 space-y-5 px-4 pt-3 pb-28">
        <div className="flex items-center gap-2">
          <AppBackButton
            fallback={returnBookingsPath}
            ariaLabel={t("backAria")}
          />
          <h1 className="font-heading text-lg font-semibold leading-tight text-foreground">
            {t("title")}
          </h1>
        </div>

        <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-4">
          <div className="space-y-2">
            <h2
              className="text-sm font-semibold text-foreground"
              id="rate-spec"
            >
              {specialistLabel}
            </h2>
            <RatingInput
              value={specRating}
              onChange={setSpecRating}
              sectionId="rate-spec"
            />
            <label className="sr-only" htmlFor="visit-spec-comment">
              {t("commentSpecialistPlaceholder")}
            </label>
            <textarea
              id="visit-spec-comment"
              className="min-h-[4.5rem] w-full resize-y rounded-xl border border-border/45 bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
              rows={2}
              maxLength={2000}
              value={specComment}
              onChange={(e) => {
                setSpecComment(e.target.value);
              }}
              placeholder={t("commentSpecialistPlaceholder")}
            />
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-4">
          <div className="space-y-2">
            <h2
              className="text-sm font-semibold text-foreground"
              id="rate-org"
            >
              {salonLabel}
            </h2>
            <RatingInput
              value={orgRating}
              onChange={setOrgRating}
              sectionId="rate-org"
            />
            <label className="sr-only" htmlFor="visit-org-comment">
              {t("commentSalonPlaceholder")}
            </label>
            <textarea
              id="visit-org-comment"
              className="min-h-[4.5rem] w-full resize-y rounded-xl border border-border/45 bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
              rows={2}
              maxLength={2000}
              value={orgComment}
              onChange={(e) => {
                setOrgComment(e.target.value);
              }}
              placeholder={t("commentSalonPlaceholder")}
            />
          </div>
        </div>

        <Button
          type="button"
          className="h-12 w-full rounded-xl font-medium"
          disabled={!canSubmit || submitBusy}
          aria-busy={submitBusy}
          onClick={() => void onSubmit()}
        >
          {submitBusy ? t("submitting") : t("submit")}
        </Button>
      </div>
      <HomeBottomNav activeId="bookings" />
    </div>
  );
}
