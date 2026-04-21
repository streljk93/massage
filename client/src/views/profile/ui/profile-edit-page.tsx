"use client";

import {
  startTransition,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import { ProfileSubpageShell } from "./profile-subpage-shell";
import { profileUserDemo } from "../lib/mock-data";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { UserAvatar } from "@/shared/ui";
import { cn } from "@/shared/lib";
import {
  createBrowserSdkClient,
  filesUploadPublic,
  usersMe,
  usersPatchMe,
} from "@/shared/api";
import { resolveApiResourceUrl } from "@/shared/api/resolve-api-resource-url";

const labelClass = "text-xs font-medium text-muted-foreground";

const acceptImage =
  "image/jpeg,image/png,image/webp,image/gif" as const;

type LoadState = "idle" | "loading" | "ready" | "error" | "demo";

function pickFirstImageFile(fileList: FileList | undefined): File | undefined {
  const f = fileList?.[0];
  if (!f?.type.startsWith("image/")) {
    return undefined;
  }
  return f;
}

export function ProfileEditPage() {
  const t = useTranslations("profileEdit");
  const { data: session, status, update } = useSession();
  const accessToken = session?.accessToken;

  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  /** Значение с сервера; обновляется после успешного GET /users/me или Save. */
  const [serverAvatarPath, setServerAvatarPath] = useState<string | null>(null);
  /** Локально выбранный файл — загрузка в S3 только по Save. */
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  /** Пользователь нажал «Убрать фото» до сохранения. */
  const [removeAvatarRequested, setRemoveAvatarRequested] = useState(false);
  const [objectPreview, setObjectPreview] = useState<string | null>(null);

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pendingFile) {
      startTransition(() => setObjectPreview(null));
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    startTransition(() => setObjectPreview(url));
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [pendingFile]);

  useEffect(() => {
    if (status === "loading") {
      return;
    }
    if (!accessToken) {
      startTransition(() => {
        setFirstName(
          session?.user?.name?.trim() || profileUserDemo.firstName,
        );
        setEmail(session?.user?.email ?? profileUserDemo.email);
        setServerAvatarPath(null);
        setPendingFile(null);
        setRemoveAvatarRequested(false);
        setLoadState("demo");
      });
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadState("loading");
      const client = createBrowserSdkClient(accessToken);
      const res = await usersMe({ client });
      if (cancelled) {
        return;
      }
      if (res.error || !res.data) {
        setLoadState("error");
        return;
      }
      setFirstName(res.data.name);
      setEmail(res.data.email);
      setServerAvatarPath(res.data.avatarUrl);
      setPendingFile(null);
      setRemoveAvatarRequested(false);
      setLoadState("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken, session?.user?.email, session?.user?.name, status]);

  const demoFallbackImage =
    loadState === "demo" ? session?.user?.image : undefined;

  const avatarDisplaySrc = (() => {
    /** Сначала сброс фото: иначе `objectPreview` из выбранного файла ещё один кадр перекрывает fallback. */
    if (removeAvatarRequested) {
      return undefined;
    }
    if (objectPreview) {
      return objectPreview;
    }
    if (serverAvatarPath) {
      return resolveApiResourceUrl(serverAvatarPath);
    }
    return demoFallbackImage;
  })();

  const avatarFallback =
    firstName.trim().slice(0, 2).toUpperCase() ||
    email.split("@")[0]?.slice(0, 2).toUpperCase() ||
    "?";

  const onSave = async () => {
    if (!accessToken || loadState !== "ready") {
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      const client = createBrowserSdkClient(accessToken);

      let avatarUrl: string | null;
      if (removeAvatarRequested) {
        avatarUrl = null;
      } else if (pendingFile) {
        const up = await filesUploadPublic({
          client,
          body: { file: pendingFile },
        });
        if (up.error || !up.data) {
          setSaveError(t("avatarUploadFailed"));
          return;
        }
        avatarUrl = up.data.url;
      } else {
        avatarUrl = serverAvatarPath;
      }

      const res = await usersPatchMe({
        client,
        body: {
          name: firstName.trim(),
          avatarUrl,
        },
      });
      if (res.error || !res.data) {
        setSaveError(t("saveError"));
        return;
      }
      await update({
        name: res.data.name,
        avatarUrl: res.data.avatarUrl,
      });
      setServerAvatarPath(res.data.avatarUrl);
      setPendingFile(null);
      setRemoveAvatarRequested(false);
    } finally {
      setSaving(false);
    }
  };

  const canUseApi = !!accessToken && loadState === "ready";
  const nameDisabled =
    status === "loading" || (!!accessToken && loadState === "loading");
  const emailDisabled = status === "loading" || (!!accessToken && loadState === "loading");

  const showRemovePhoto =
    canUseApi &&
    !removeAvatarRequested &&
    (serverAvatarPath !== null || pendingFile !== null);

  const onFileChosen = (file: File | undefined) => {
    if (!file) {
      return;
    }
    setSaveError(null);
    setRemoveAvatarRequested(false);
    setPendingFile(file);
  };

  const openAvatarPicker = () => {
    if (canUseApi && !saving) {
      fileInputRef.current?.click();
    }
  };

  return (
    <ProfileSubpageShell title={t("title")}>
      <div className="space-y-6">
        {loadState === "error" ? (
          <p className="text-sm text-destructive" role="alert">
            {t("loadError")}
          </p>
        ) : null}

        {loadState === "demo" ? (
          <p className="text-sm text-muted-foreground">{t("backendRequired")}</p>
        ) : null}

        <div className="flex flex-col items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptImage}
            className="sr-only"
            tabIndex={-1}
            disabled={!canUseApi || saving}
            onChange={(e) => {
              const f = pickFirstImageFile(e.target.files ?? undefined);
              e.target.value = "";
              onFileChosen(f);
            }}
          />

          <button
            type="button"
            disabled={!canUseApi || saving}
            onClick={openAvatarPicker}
            className={cn(
              "group relative shrink-0 rounded-full p-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              (!canUseApi || saving) && "cursor-not-allowed opacity-50",
            )}
            aria-label={t("avatarEditAria")}
          >
            <UserAvatar
              src={avatarDisplaySrc}
              alt={firstName.trim() || email}
              fallback={avatarFallback}
              size="default"
              className="size-44 border-2 border-border/70 sm:size-52 [&_[data-slot=avatar-fallback]]:text-3xl sm:[&_[data-slot=avatar-fallback]]:text-4xl"
            />
            <span
              className="absolute right-0.5 bottom-0.5 z-10 flex size-10 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background sm:right-1 sm:bottom-1 sm:size-11"
              aria-hidden
            >
              <Pencil className="size-[18px] sm:size-5" strokeWidth={2} />
            </span>
          </button>

          {pendingFile && !saving ? (
            <p className="text-center text-xs font-medium text-amber-700 dark:text-amber-500">
              {t("avatarPending")}
            </p>
          ) : null}

          <p className="max-w-sm text-center text-xs text-muted-foreground">
            {t("avatarHint")}
          </p>

          {showRemovePhoto ? (
            <Button
              type="button"
              variant="secondary"
              tone="light"
              size="sm"
              className="max-w-xs border border-border/80 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={!canUseApi || saving}
              onClick={() => {
                setPendingFile(null);
                setRemoveAvatarRequested(true);
                setSaveError(null);
              }}
            >
              {t("avatarRemove")}
            </Button>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className={cn(labelClass)}>{t("firstNameLabel")}</p>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="name"
              disabled={nameDisabled}
            />
          </div>
          <div className="space-y-2">
            <p className={cn(labelClass)}>{t("emailLabel")}</p>
            <Input
              type="email"
              value={email}
              autoComplete="email"
              readOnly
              disabled={emailDisabled}
              className="bg-muted/40"
            />
          </div>
        </div>

        {saveError ? (
          <p className="text-sm text-destructive" role="alert">
            {saveError}
          </p>
        ) : null}

        <Button
          type="button"
          variant="primary"
          className="w-full rounded-xl"
          disabled={!canUseApi || saving || nameDisabled}
          aria-busy={saving}
          onClick={() => void onSave()}
        >
          {saving ? t("saving") : t("save")}
        </Button>
      </div>
    </ProfileSubpageShell>
  );
}
