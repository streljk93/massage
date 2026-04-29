"use client";

import { useTranslations } from "next-intl";
import { ImageMediaDropzone, Input } from "@/shared/ui";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/shared/ui/shadcn/input-group";
import { cn } from "@/shared/lib";
import { EXP_ORDER } from "../../lib/specialist-onboarding-utils";
import { useSpecialistOnboarding } from "../specialist-onboarding-context";

export default function SpecialistOnboardingStepProfile() {
  const t = useTranslations("specialistOnboarding");
  const {
    profileSaving,
    photoPreviewUrl,
    photoFileLabel,
    setPendingPhotoFile,
    pName,
    setPName,
    pPhoneLocal,
    setPPhoneLocal,
    pBio,
    setPBio,
    pExp,
    setPExp,
  } = useSpecialistOnboarding();

  return (
    <section className="space-y-3">
      <h1 className="font-heading text-2xl font-semibold text-foreground">
        {t("step2Title")}
      </h1>
      <p className="text-pretty text-[0.9375rem] text-muted-foreground">
        {t("step2Sub")}
      </p>
      <div className="space-y-2">
        <span className="text-sm font-medium">{t("photoLabel")}</span>
        <ImageMediaDropzone
          disabled={profileSaving}
          title={t("uploadPhoto")}
          hint={t("uploadHint")}
          dropzoneAriaLabel={
            photoPreviewUrl ? t("changePhoto") : t("uploadPhoto")
          }
          previewUrl={photoPreviewUrl}
          fileLabel={photoFileLabel}
          titleWithPreview={t("changePhoto")}
          hintWithPreview={t("photoReplaceHint")}
          onFileChosen={(file) => setPendingPhotoFile(file)}
        />
      </div>
      <div className="space-y-1.5">
        <span className="text-sm font-medium">{t("fieldName")}</span>
        <Input
          className="rounded-full border-0 bg-muted/50"
          value={pName}
          disabled={profileSaving}
          onChange={(e) => setPName(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <span className="text-sm font-medium">{t("fieldPhone")}</span>
        <p className="text-xs text-muted-foreground">{t("fieldPhoneVnOnly")}</p>
        <InputGroup
          className="h-12 min-h-12 w-full items-stretch rounded-full border-0 bg-muted/50 pl-0.5 has-disabled:opacity-60"
          aria-label={t("fieldPhoneGroupAria")}
        >
          <InputGroupAddon
            align="inline-start"
            className="shrink-0 border-r border-border/50 pr-2 pl-3"
          >
            <InputGroupText className="text-foreground tabular-nums">
              +84
            </InputGroupText>
            <span className="text-xs text-muted-foreground" aria-hidden>
              ·
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              VN
            </span>
          </InputGroupAddon>
          <InputGroupInput
            className="h-12 min-w-0 text-base"
            value={pPhoneLocal}
            disabled={profileSaving}
            onChange={(e) => {
              const next = e.target.value.replace(/\D/g, "").slice(0, 12);
              setPPhoneLocal(next);
            }}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder={t("phoneLocalPlaceholder")}
          />
        </InputGroup>
      </div>
      <div className="space-y-1.5">
        <span className="text-sm font-medium">{t("fieldBio")}</span>
        <textarea
          className="w-full rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
          rows={4}
          value={pBio}
          disabled={profileSaving}
          onChange={(e) => setPBio(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <span className="text-sm font-medium">{t("fieldExp")}</span>
        <div className="flex flex-wrap gap-2">
          {EXP_ORDER.map((k) => {
            const labelKey =
              k === "0-1"
                ? "exp_0_1"
                : k === "1-3"
                  ? "exp_1_3"
                  : k === "3-5"
                    ? "exp_3_5"
                    : "exp_5p";
            const selected = pExp === k;
            return (
              <button
                key={k}
                type="button"
                disabled={profileSaving}
                onClick={() => setPExp(k)}
                className={cn(
                  "touch-target rounded-full border px-3.5 py-2 text-sm disabled:opacity-50",
                  selected
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-muted/30",
                )}
              >
                {t(labelKey as "exp_0_1")}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
