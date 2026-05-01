"use client";

import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/app/i18n/navigation";
import type { AppLocale } from "@/app/i18n/routing";
import {
  contentModerationApprove,
  contentModerationListCases,
  contentModerationReject,
  createBrowserSdkClient,
  usersMe,
  type UsersMeResponse,
} from "@/shared/api";
import { Button } from "@/shared/ui/button";
import { Button as RawButton } from "@/shared/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/shadcn/dialog";
import { Textarea } from "@/shared/ui/shadcn/textarea";
import {
  type ModerationCaseRow,
  ModerationGuestPreview,
  ModerationPendingPreview,
} from "./moderation-case-previews";

type MeGateState =
  | { status: "idle" | "loading" }
  | { status: "ready" }
  | { status: "forbidden" };

function moderationKindLabel(
  kind: ModerationCaseRow["kind"],
  tkinds: ReturnType<typeof useTranslations>,
): string {
  return tkinds(kind);
}

export function AdminModerationPage() {
  const tt = useTranslations("admin.table");
  const tk = useTranslations("admin.kinds");
  const t = useTranslations("admin");
  const tr = useTranslations("admin.rejectDialog");
  const locale = useLocale() as AppLocale;
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken;

  const [meState, setMeState] = useState<MeGateState>({ status: "idle" });

  const [cases, setCases] = useState<ModerationCaseRow[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<ModerationCaseRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const refreshList = useCallback(async () => {
    if (!accessToken) {
      return;
    }
    const client = createBrowserSdkClient(accessToken, { locale });
    const res = await contentModerationListCases({
      client,
      query: { limit: 100 },
    });
    if (res.error || res.data === undefined || res.data === null) {
      setListError("list_failed");
      setCases([]);
      return;
    }
    setListError(null);
    setCases(res.data as ModerationCaseRow[]);
  }, [accessToken, locale]);

  useEffect(() => {
    if (sessionStatus !== "authenticated" || accessToken == null) {
      return;
    }
    let cancelled = false;
    void (async () => {
      setMeState({ status: "loading" });
      const client = createBrowserSdkClient(accessToken, { locale });
      const res = await usersMe({ client });
      if (cancelled) return;
      if (res.error || !res.data) {
        setMeState({ status: "forbidden" });
        setCases([]);
        return;
      }
      const me = res.data as UsersMeResponse;
      const allowed =
        me.platformRole === "master" || me.isContentModerator === true;
      setMeState(allowed ? { status: "ready" } : { status: "forbidden" });
      if (!allowed) {
        setCases([]);
        return;
      }
      await refreshList();
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, locale, refreshList, sessionStatus]);

  const canAct = meState.status === "ready";

  const handleApprove = async (row: ModerationCaseRow) => {
    if (!accessToken || !canAct) return;
    setBusyId(row.id);
    try {
      const client = createBrowserSdkClient(accessToken, { locale });
      const res = await contentModerationApprove({
        client,
        path: { caseId: row.id },
      });
      if (!res.error) {
        await refreshList();
      }
    } finally {
      setBusyId(null);
    }
  };

  const openReject = (row: ModerationCaseRow) => {
    setRejectFor(row);
    setRejectReason("");
  };

  const submitReject = async () => {
    if (!rejectFor || !accessToken || rejectSubmitting || !canAct) return;
    const reason = rejectReason.trim();
    if (reason.length < 1) return;
    setRejectSubmitting(true);
    try {
      const client = createBrowserSdkClient(accessToken, { locale });
      const res = await contentModerationReject({
        client,
        path: { caseId: rejectFor.id },
        body: { reason },
        headers: { "Content-Type": "application/json" },
      });
      if (!res.error) {
        setRejectFor(null);
        setRejectReason("");
        await refreshList();
      }
    } finally {
      setRejectSubmitting(false);
      setBusyId(null);
    }
  };

  if (sessionStatus === "loading") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
        <span className="text-sm text-muted-foreground">{t("loading")}</span>
      </div>
    );
  }

  if (sessionStatus === "unauthenticated" || accessToken == null) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h1 className="font-heading text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("signInPrompt")}</p>
        <Button asChild>
          <Link href="/login">{t("signInCta")}</Link>
        </Button>
      </div>
    );
  }

  if (meState.status === "loading" || meState.status === "idle") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
        <span className="text-sm text-muted-foreground">{t("loading")}</span>
      </div>
    );
  }

  if (meState.status === "forbidden") {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h1 className="font-heading text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("forbidden")}</p>
        <p className="text-sm text-muted-foreground">{t("accessDeniedLoggedIn")}</p>
        <Button asChild variant="secondary">
          <Link href="/">{t("backHome")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-6 p-4 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Button asChild variant="ghost" className="-ml-2 h-auto px-2 py-1 text-muted-foreground" size="sm">
            <Link href="/">{t("backHome")}</Link>
          </Button>
          <h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("tabModeration")}</p>
        </div>
      </div>

      {listError && (
        <p className="text-sm text-destructive" role="alert">
          {listError === "list_failed" ? tt("listFailed") : listError}
        </p>
      )}

      {cases && cases.length === 0 && !listError && (
        <p className="text-sm text-muted-foreground">{t("emptyQueue")}</p>
      )}

      {cases != null && cases.length > 0 && (
        <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
          <table className="w-full min-w-[1100px] border-collapse text-left text-sm xl:min-w-0 xl:table-fixed">
            <colgroup>
              <col className="w-[10rem]" />
              <col className="xl:w-[22%]" />
              <col className="xl:w-[22%]" />
              <col className="xl:w-[26%]" />
              <col className="w-[8.5rem]" />
            </colgroup>
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="p-3 font-medium">{tt("kind")}</th>
                <th className="p-3 font-medium">{tt("previewGuest")}</th>
                <th className="p-3 font-medium">{tt("previewPending")}</th>
                <th className="p-3 font-medium">{tt("aiSummary")}</th>
                <th className="p-3 font-medium">{tt("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((row) => (
                <tr key={row.id} className="border-b align-top last:border-b-0">
                  <td className="p-3 align-top text-muted-foreground whitespace-nowrap">
                    {moderationKindLabel(row.kind, tk)}
                  </td>
                  <td className="p-3 align-top">
                    <ModerationGuestPreview row={row} />
                  </td>
                  <td className="p-3 align-top">
                    <ModerationPendingPreview row={row} />
                  </td>
                  <td className="p-3 align-top whitespace-pre-wrap break-words text-muted-foreground">
                    {(row.aiSummary ?? "").trim() || "—"}
                  </td>
                  <td className="p-3 align-top">
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        disabled={
                          busyId === row.id ||
                          rejectSubmitting ||
                          !canAct
                        }
                        onClick={() => void handleApprove(row)}
                      >
                        {busyId === row.id ?
                          <Loader2 className="size-4 animate-spin" />
                        : tt("approve")}
                      </Button>
                      <RawButton
                        size="sm"
                        variant="destructive"
                        type="button"
                        disabled={
                          busyId === row.id ||
                          rejectSubmitting ||
                          !canAct
                        }
                        onClick={() => openReject(row)}
                      >
                        {tt("reject")}
                      </RawButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={rejectFor !== null} onOpenChange={(o) => !o && setRejectFor(null)}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>{tr("title")}</DialogTitle>
          </DialogHeader>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">{tr("reasonLabel")}</span>
            <Textarea
              rows={4}
              value={rejectReason}
              placeholder={tr("reasonPlaceholder")}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </label>
          <DialogFooter>
            <RawButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRejectFor(null)}
              disabled={rejectSubmitting}
            >
              {tr("cancel")}
            </RawButton>
            <RawButton
              type="button"
              variant="destructive"
              size="sm"
              disabled={
                rejectReason.trim().length < 1 || rejectSubmitting
              }
              onClick={() => void submitReject()}
            >
              {rejectSubmitting ?
                <Loader2 className="size-4 animate-spin" />
              : tr("submit")}
            </RawButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
