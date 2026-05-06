"use client";

import { useTranslations } from "next-intl";
import { Checkbox, ImageMediaDropzone, Input } from "@/shared/ui";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/shared/ui/shadcn/input-group";
import { cn } from "@/shared/lib";
import type { ExperienceKey } from "../lib/specialist-experience-range";
import { EXP_ORDER } from "../lib/specialist-experience-range";

export type SpecialistProfileEditFormProps = {
  profileSaving: boolean;
  photoPreviewUrl: string | null;
  photoFileLabel: string | null;
  onPhotoFileChosen: (file: File | null) => void;
  name: string;
  onNameChange: (value: string) => void;
  gender: "male" | "female" | null;
  onGenderChange: (value: "male" | "female") => void;
  phoneLocal: string;
  onPhoneLocalChange: (value: string) => void;
  bio: string;
  onBioChange: (value: string) => void;
  experienceKey: ExperienceKey | null;
  onExperienceKeyChange: (value: ExperienceKey | null) => void;
  strength: number;
  onStrengthChange: (value: number) => void;
  adapt: boolean;
  onAdaptChange: (value: boolean) => void;
  /** Заголовок и подзаголовок шага 2 онбординга; на странице редактирования — выключить. */
  showOnboardingIntro?: boolean;
};

export function SpecialistProfileEditForm({
  profileSaving,
  photoPreviewUrl,
  photoFileLabel,
  onPhotoFileChosen,
  name,
  onNameChange,
  gender,
  onGenderChange,
  phoneLocal,
  onPhoneLocalChange,
  bio,
  onBioChange,
  experienceKey,
  onExperienceKeyChange,
  strength,
  onStrengthChange,
  adapt,
  onAdaptChange,
  showOnboardingIntro = true,
}: SpecialistProfileEditFormProps) {
  const t = useTranslations("specialistOnboarding");

  return (
    <section className="space-y-3">
      {showOnboardingIntro ?
        <>
          <h1 className="font-heading text-2xl font-semibold text-foreground">{t("step2Title")}</h1>
          <p className="text-pretty text-[0.9375rem] text-muted-foreground">{t("step2Sub")}</p>
        </>
      : null}
      <div className="space-y-2">
        <span className="text-sm font-medium">{t("photoLabel")}</span>
        <ImageMediaDropzone
          disabled={profileSaving}
          title={t("uploadPhoto")}
          hint={t("uploadHint")}
          dropzoneAriaLabel={photoPreviewUrl ? t("changePhoto") : t("uploadPhoto")}
          previewUrl={photoPreviewUrl}
          fileLabel={photoFileLabel}
          titleWithPreview={t("changePhoto")}
          hintWithPreview={t("photoReplaceHint")}
          onFileChosen={(file) => onPhotoFileChosen(file)}
        />
      </div>
      <div className="space-y-1.5">
        <span className="text-sm font-medium">{t("fieldName")}</span>
        <Input
          className="rounded-full border-0 bg-muted/50"
          value={name}
          disabled={profileSaving}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <span className="text-sm font-medium">{t("fieldGender")}</span>
        <div className="flex gap-2">
          {([
            { id: "male", label: t("genderMale") },
            { id: "female", label: t("genderFemale") },
          ] as const).map((opt) => {
            const selected = gender === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={profileSaving}
                onClick={() => onGenderChange(opt.id)}
                className={cn(
                  "touch-target rounded-full border px-3.5 py-2 text-sm disabled:opacity-50",
                  selected
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-muted/30",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
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
            <InputGroupText className="text-foreground tabular-nums">+84</InputGroupText>
            <span className="text-xs text-muted-foreground" aria-hidden>
              ·
            </span>
            <span className="text-xs font-medium text-muted-foreground">VN</span>
          </InputGroupAddon>
          <InputGroupInput
            className="h-12 min-w-0 text-base"
            value={phoneLocal}
            disabled={profileSaving}
            onChange={(e) => {
              const next = e.target.value.replace(/\D/g, "").slice(0, 12);
              onPhoneLocalChange(next);
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
          value={bio}
          disabled={profileSaving}
          onChange={(e) => onBioChange(e.target.value)}
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
            const selected = experienceKey === k;
            return (
              <button
                key={k}
                type="button"
                disabled={profileSaving}
                onClick={() => onExperienceKeyChange(k)}
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

      <div className="space-y-3 rounded-2xl bg-muted/20 p-4 ring-1 ring-inset ring-border/40">
        <span className="text-sm font-medium text-foreground">{t("strengthLabel")}</span>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="max-w-[40%] leading-snug">{t("strengthLeft")}</span>
          <span className="max-w-[40%] text-right leading-snug">{t("strengthRight")}</span>
        </div>
        <div
          className={cn("flex gap-1.5 transition-opacity", adapt && "opacity-45")}
          role="group"
          aria-label={t("strengthLabel")}
        >
          {[1, 2, 3, 4, 5].map((d) => {
            const on = d <= strength;
            return (
              <button
                key={d}
                type="button"
                onClick={() => onStrengthChange(d)}
                disabled={profileSaving || adapt}
                className={cn(
                  "box-border flex h-12 min-h-12 min-w-0 flex-1 touch-target items-center justify-center rounded-xl border-2 text-sm font-semibold tabular-nums transition-colors duration-150 disabled:opacity-50",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/60 bg-background/90 text-foreground/55 hover:border-primary/30 hover:bg-muted/40",
                )}
                aria-pressed={on}
                aria-label={`${d} / 5`}
              >
                {d}
              </button>
            );
          })}
        </div>
        <label
          className={cn(
            "mt-1 flex cursor-pointer items-start gap-3 border-t border-border/30 pt-3",
            "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-primary/30",
          )}
        >
          <Checkbox
            className="mt-0.5"
            disabled={profileSaving}
            checked={adapt}
            onCheckedChange={(c) => onAdaptChange(c === true)}
          />
          <span className="text-pretty text-sm leading-snug text-foreground">{t("adaptCheck")}</span>
        </label>
      </div>
    </section>
  );
}
