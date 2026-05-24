"use client";

import { Globe, Mail, MapPin, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/app/i18n/navigation";
import { AppBackButton } from "@/shared/ui";
import { cn, motion } from "@/shared/lib";
import { httpsHrefFromWebsiteStored } from "@/shared/lib/http-href";
import { telHrefFromDisplayPhone } from "@/shared/lib/tel-href";
import {
  HomeBottomNav,
  consumerPageRootClass,
  consumerSubpageContentClass,
} from "@/widgets/home";

export type OrganizationDetailsStaffItem = {
  id: string;
  name: string;
  imageSrc: string;
  imageAlt: string;
};

export type OrganizationDetailsPageProps = {
  organizationId: string;
  name: string;
  description: string | null;
  addressLine: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  staff: OrganizationDetailsStaffItem[];
};

function formatAddressLine(
  addressLine: string | null,
  city: string | null,
): string {
  return [addressLine?.trim(), city?.trim()].filter(Boolean).join(", ");
}

function websiteLinkLabel(stored: string): string {
  return stored
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");
}

export function OrganizationDetailsPage({
  organizationId,
  name,
  description,
  addressLine,
  city,
  phone,
  email,
  website,
  staff,
}: OrganizationDetailsPageProps) {
  const t = useTranslations("organizationDetails");
  const fallback = `/organizations/${organizationId}`;
  const trimmed = description?.trim() ?? "";
  const addressFormatted = formatAddressLine(addressLine, city);
  const phoneHref = telHrefFromDisplayPhone(phone);
  const emailTrimmed = email?.trim() ?? "";
  const websiteStoredTrimmed = website?.trim() ?? "";
  const websiteHref = httpsHrefFromWebsiteStored(websiteStoredTrimmed);
  const phoneTrimmed = phone?.trim() ?? "";

  const showContactBlock = Boolean(
    addressFormatted || phoneTrimmed || emailTrimmed || websiteHref,
  );

  return (
    <div className={consumerPageRootClass()}>
      <div className={consumerSubpageContentClass()}>
        <div className="mb-6 flex items-center gap-2">
          <AppBackButton
            fallback={fallback}
            ariaLabel={t("backAria")}
            className="lg:hidden"
          />
          <div className="min-w-0">
            <h1 className="font-heading text-lg font-semibold leading-tight text-foreground lg:text-2xl">
              {t("title")}
            </h1>
            <p className="truncate text-sm text-muted-foreground">{name}</p>
          </div>
        </div>

        <section className="rounded-[1.35rem] border border-border/70 bg-card px-4 py-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("aboutHeading")}
          </h2>
          {trimmed ? (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {trimmed}
            </p>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {t("descriptionEmpty")}
            </p>
          )}
        </section>

        {showContactBlock ? (
          <section className="mt-4 rounded-[1.35rem] border border-border/70 bg-card px-4 py-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("contactHeading")}
            </h2>
            <ul className="mt-3 space-y-3 text-sm">
              {addressFormatted ? (
                <li className="flex gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MapPin className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 pt-1">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("addressLabel")}
                    </p>
                    <p className="mt-1 leading-relaxed text-foreground/90">
                      {addressFormatted}
                    </p>
                  </div>
                </li>
              ) : null}
              {phoneTrimmed ? (
                <li className="flex gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Phone className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 pt-1">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("phoneLabel")}
                    </p>
                    {phoneHref ? (
                      <a
                        href={phoneHref}
                        className="mt-1 inline-block font-medium text-primary underline-offset-2 hover:underline"
                        aria-label={t("phoneCallAria")}
                      >
                        {phoneTrimmed}
                      </a>
                    ) : (
                      <p className="mt-1 font-medium text-foreground/90">
                        {phoneTrimmed}
                      </p>
                    )}
                  </div>
                </li>
              ) : null}
              {emailTrimmed ? (
                <li className="flex gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Mail className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 pt-1">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("emailLabel")}
                    </p>
                    <a
                      href={`mailto:${emailTrimmed}`}
                      className="mt-1 inline-block break-all font-medium text-primary underline-offset-2 hover:underline"
                      aria-label={t("emailWriteAria")}
                    >
                      {emailTrimmed}
                    </a>
                  </div>
                </li>
              ) : null}
              {websiteHref ? (
                <li className="flex gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Globe className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 pt-1">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("websiteLabel")}
                    </p>
                    <a
                      href={websiteHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block break-all font-medium text-primary underline-offset-2 hover:underline"
                      aria-label={t("websiteOpenAria")}
                    >
                      {websiteLinkLabel(websiteStoredTrimmed)}
                    </a>
                  </div>
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}

        {staff.length > 0 ? (
          <section className="mt-4 rounded-[1.35rem] border border-border/70 bg-card px-4 py-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("specialistsHeading")}
            </h2>
            <div className="relative -mx-4 mt-3">
              <ul
                className="flex gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:thin]"
                aria-label={t("specialistsHeading")}
              >
                {staff.map((s) => (
                  <li key={s.id} className="w-[4.75rem] shrink-0">
                    <Link
                      href={`/specialists/${s.id}`}
                      aria-label={t("specialistProfileAria", { name: s.name })}
                      className={cn(
                        motion.interactivePressStrong,
                        "flex flex-col items-center gap-2 rounded-2xl p-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      )}
                    >
                      <span className="relative size-16 overflow-hidden rounded-full border border-border/50 bg-muted/30 shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element -- remote directory avatars */}
                        <img
                          src={s.imageSrc}
                          alt={s.imageAlt}
                          className="size-full object-cover"
                        />
                      </span>
                      <span className="line-clamp-2 w-full text-center text-[0.7rem] font-medium leading-snug text-foreground">
                        {s.name}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}
      </div>

      <HomeBottomNav activeId="search" />
    </div>
  );
}
