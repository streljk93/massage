"use client";

import type { LucideIcon } from "lucide-react";
import {
  Award,
  FileText,
  Phone,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@/app/i18n/navigation";
import type { CabinetSpecialistBlob } from "../model/cabinet-specialist.types";
import {
  specialistCabinetExpTranslationKey,
  specialistCabinetYearsToKey,
} from "../lib/specialist-cabinet-experience";
import { displaySpecialistCabinetPhone } from "../lib/specialist-cabinet-phone-display";
import {
  cn,
  motion,
  previewSrcForPersistedGalleryUrl,
  telHrefFromDisplayPhone,
} from "@/shared/lib";
import { FullScreenPhotoGallery } from "@/shared/ui";

function ProfileInfoRow({
  icon: Icon,
  label,
  children,
  empty,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="flex gap-2.5 rounded-xl border border-border/45 bg-muted/12 px-3 py-2.5 dark:bg-muted/18">
      <div
        className="mt-px flex size-8 shrink-0 items-center justify-center rounded-lg bg-background/90 text-primary ring-1 ring-border/35 dark:bg-background/45"
        aria-hidden
      >
        <Icon className="size-3.5 opacity-90" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-[0.625rem] font-semibold tracking-[0.05em] text-muted-foreground uppercase">
          {label}
        </p>
        <div
          className={cn(
            "text-pretty text-sm leading-snug",
            empty ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export type BusinessSpecialistCabinetProfileProps = {
  specialist: CabinetSpecialistBlob;
};

export function BusinessSpecialistCabinetProfile({
  specialist,
}: BusinessSpecialistCabinetProfileProps) {
  const t = useTranslations("businessAppSubpages");
  const tOnb = useTranslations("specialistOnboarding");

  const skillCategories = useMemo(() => {
    const rows = (
      specialist as {
        skillCategories?: Array<{ categoryId: string; name: string }>;
      }
    ).skillCategories;
    return Array.isArray(rows) ? rows : [];
  }, [specialist]);

  const vitrineName =
    specialist?.listingName != null && String(specialist.listingName).trim().length > 0
      ? String(specialist.listingName).trim()
      : null;
  const bio =
    specialist?.bio != null && String(specialist.bio).trim().length > 0
      ? String(specialist.bio).trim()
      : null;
  const phoneLine = displaySpecialistCabinetPhone(
    specialist?.userPhone != null ? String(specialist.userPhone) : null,
  );
  const phoneTelHref = telHrefFromDisplayPhone(
    specialist?.userPhone != null ? String(specialist.userPhone) : null,
  );
  const rawExp = specialist?.experienceYears;
  const expYears =
    typeof rawExp === "number" && Number.isFinite(rawExp) ? rawExp : null;
  const expKey = expYears != null ? specialistCabinetYearsToKey(expYears) : null;

  const massage = specialist?.massage as
    | {
        pressureLevel?: number | null;
        pressureAdaptsToClient?: boolean | null;
      }
    | null
    | undefined;

  const adapt = massage?.pressureAdaptsToClient === true;
  const pressureLevel =
    typeof massage?.pressureLevel === "number" &&
    massage.pressureLevel >= 1 &&
    massage.pressureLevel <= 5
      ? massage.pressureLevel
      : null;

  const imageRaw =
    specialist?.imageUrl != null && String(specialist.imageUrl).trim().length > 0
      ? String(specialist.imageUrl).trim()
      : null;
  const photoSrc = imageRaw ? previewSrcForPersistedGalleryUrl(imageRaw) : null;

  const profilePhotoAlt = vitrineName ?? tOnb("photoLabel");

  const profileGalleryItems = useMemo(
    () => (photoSrc ? [{ src: photoSrc, alt: profilePhotoAlt }] : []),
    [photoSrc, profilePhotoAlt],
  );

  const [profilePhotoGalleryOpen, setProfilePhotoGalleryOpen] = useState(false);

  const publicationModerationRaw = (specialist as Record<string, unknown>)
    .profilePublicationModerationStatus;
  const publicationModerationStatus =
    publicationModerationRaw === "pending_review" ||
    publicationModerationRaw === "rejected" ||
    publicationModerationRaw === "approved"
      ? publicationModerationRaw
      : undefined;

  const avatarFallback = (
    vitrineName?.trim().slice(0, 2) ||
    String(specialist?.userName ?? "").trim().slice(0, 2) ||
    "B"
  ).toUpperCase();

  return (
    <section
      className="flex flex-col gap-3"
      aria-label={t("profileDetailSectionAria")}
    >
      <div className="flex flex-col items-center gap-2 px-3 py-2.5 text-center">
        {photoSrc ?
          <>
            <button
              type="button"
              className="group shrink-0 overflow-hidden rounded-lg bg-background/90 ring-1 ring-border/35 transition-[opacity,transform] hover:opacity-95 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-background/45"
              aria-label={t("profilePhotoOpenGalleryAria")}
              onClick={() => setProfilePhotoGalleryOpen(true)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- API-persisted absolute or app-relative file URL */}
              <img
                src={photoSrc}
                alt={profilePhotoAlt}
                className="size-14 object-cover"
                draggable={false}
              />
            </button>
            <FullScreenPhotoGallery
              open={profilePhotoGalleryOpen}
              onOpenChange={setProfilePhotoGalleryOpen}
              items={profileGalleryItems}
              initialIndex={0}
              closeLabel={t("profilePhotoGalleryCloseAria")}
              title={t("profilePhotoGalleryTitle")}
              formatPhotoProgress={(current, total) =>
                t("profilePhotoGalleryProgress", { current, total })
              }
            />
          </>
        : (
          <div
            className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-background/90 font-heading text-xs font-normal tracking-tight text-muted-foreground ring-1 ring-border/35 dark:bg-background/45"
            aria-hidden
          >
            {avatarFallback}
          </div>
        )}
        <div className="flex w-full min-w-0 flex-col items-center space-y-1">
          <h2 className="font-heading w-full text-pretty text-center text-base font-medium leading-snug tracking-tight text-foreground">
            {vitrineName ?? t("profileValueEmpty")}
          </h2>
          {publicationModerationStatus === "pending_review" ||
          publicationModerationStatus === "rejected" ?
            <ul
              className="mt-2 flex list-none flex-wrap justify-center gap-1.5 p-0"
              aria-label={t("profilePublicationStatusAria")}
            >
              {publicationModerationStatus === "pending_review" ?
                <li>
                  <span className="inline-flex rounded-full bg-amber-500/14 px-2.5 py-0.5 text-xs font-medium text-amber-950 dark:text-amber-100">
                    {t("profilePublicationPendingBadge")}
                  </span>
                </li>
              : null}
              {publicationModerationStatus === "rejected" ?
                <li>
                  <span className="inline-flex rounded-full bg-destructive/12 px-2.5 py-0.5 text-xs font-medium text-destructive">
                    {t("profilePublicationRejectedBadge")}
                  </span>
                </li>
              : null}
            </ul>
          : null}
          {phoneLine && phoneTelHref ?
            <a
              href={phoneTelHref}
              className={cn(
                "touch-target mx-auto flex max-w-full items-center justify-center gap-1.5 rounded-lg py-1 text-sm tabular-nums text-primary underline-offset-2 hover:underline",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
              aria-label={t("profilePhoneCallAria", { phone: phoneLine })}
            >
              <Phone className="size-3.5 shrink-0 opacity-80" aria-hidden />
              <span>{phoneLine}</span>
            </a>
          : phoneLine ?
            <p className="mx-auto flex max-w-full items-center justify-center gap-1.5 text-sm tabular-nums text-muted-foreground">
              <Phone className="size-3.5 shrink-0 opacity-70" aria-hidden />
              <span>{phoneLine}</span>
            </p>
          : (
            <p className="w-full text-center text-sm text-muted-foreground">{t("profileValueEmpty")}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <ProfileInfoRow icon={FileText} label={tOnb("fieldBio")} empty={!bio}>
          {bio ?? t("profileValueEmpty")}
        </ProfileInfoRow>

        <ProfileInfoRow icon={Award} label={tOnb("fieldExp")} empty={expKey == null}>
          {expKey ?
            tOnb(specialistCabinetExpTranslationKey(expKey))
          : t("profileValueEmpty")}
        </ProfileInfoRow>

        <ProfileInfoRow
          icon={Sparkles}
          label={t("profileMassageSectionTitle")}
          empty={!adapt && pressureLevel == null}
        >
          {adapt ?
            tOnb("adaptCheck")
          : pressureLevel != null ?
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between gap-2 text-[0.625rem] text-muted-foreground">
                <span className="max-w-[44%] leading-tight">{tOnb("strengthLeft")}</span>
                <span className="max-w-[44%] text-right leading-tight">{tOnb("strengthRight")}</span>
              </div>
              <div className="flex gap-1" role="group" aria-label={tOnb("strengthLabel")}>
                {[1, 2, 3, 4, 5].map((d) => {
                  const on = d <= pressureLevel;
                  return (
                    <div
                      key={d}
                      className={cn(
                        "flex h-8 min-h-8 min-w-0 flex-1 items-center justify-center rounded-lg border text-xs font-semibold tabular-nums transition-colors",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/55 bg-background/65 text-muted-foreground dark:bg-background/35",
                      )}
                      aria-hidden
                    >
                      {d}
                    </div>
                  );
                })}
              </div>
              <p className="text-[0.6875rem] text-muted-foreground">{tOnb("strengthLabel")}</p>
            </div>
          : t("profileValueEmpty")}
        </ProfileInfoRow>
      </div>

      <div
        className="flex w-full flex-col gap-2 rounded-xl border border-border/45 bg-muted/12 px-3 py-2.5 dark:bg-muted/18"
        aria-label={t("profileSkillsSectionAria")}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading text-sm font-semibold tracking-tight text-foreground">
            {t("profileSkillsTitle")}
          </h2>
          <Link
            href="/business/skills"
            className={cn(
              motion.interactive,
              "shrink-0 text-xs font-medium text-primary underline-offset-4 hover:underline",
            )}
          >
            {t("profileSkillsEditLink")}
          </Link>
        </div>
        {skillCategories.length > 0 ?
          <ul className="flex flex-wrap gap-2" role="list">
            {skillCategories.map((row) => (
              <li key={row.categoryId} role="listitem">
                <span className="inline-flex rounded-full border border-border/55 bg-background/80 px-3 py-1 text-xs font-medium text-foreground">
                  {row.name}
                </span>
              </li>
            ))}
          </ul>
        : <p className="text-pretty text-sm text-muted-foreground">{t("profileSkillsEmptyHint")}</p>}
      </div>
    </section>
  );
}
