import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarDays,
  Megaphone,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";
import Image from "next/image";
import { Link } from "@/app/i18n/navigation";
import { Button, Slider } from "@/shared/ui";
import { cn } from "@/shared/lib";
import { becomeSpecialistBannerImage, becomeSpecialistHeroImages } from "../lib/landing-visuals";
import {
  landingSalonRows,
  landingSpecialistSlides,
  type LandingSalonRowSeed,
  type LandingSpecialistSlideSeed,
} from "../lib/landing-partners-seed";

type Translate = (key: string) => string;

function partnerField(
  t: Translate,
  id: LandingSpecialistSlideSeed["id"],
  field: "name" | "meta" | "services" | "imageAlt",
) {
  return t(`partners.${id}.${field}`);
}

function salonField(
  t: Translate,
  id: LandingSalonRowSeed["id"],
  field: "name" | "city" | "imageAlt",
) {
  return t(`salons.${id}.${field}`);
}

function HeroAdvantage({
  title,
  body,
  className,
}: {
  title: string;
  body: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/50 bg-muted/30 px-3 py-2.5 sm:px-3.5 sm:py-2.5",
        className,
      )}
    >
      <p className="font-heading text-sm font-semibold tracking-tight text-foreground">
        {title}
      </p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function WhatYouGetTile({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-2.5 rounded-2xl border border-border/50 bg-muted/25 p-3 sm:p-3.5">
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:size-11"
        aria-hidden
      >
        <Icon className="size-[1.125rem] sm:size-5" />
      </div>
      <div className="min-w-0 space-y-1">
        <h3 className="font-heading text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground sm:text-[0.8125rem]">
          {body}
        </p>
      </div>
    </div>
  );
}

function SpecialistSpotlightCard({
  slide,
  t,
  className,
}: {
  slide: LandingSpecialistSlideSeed;
  t: Translate;
  className?: string;
}) {
  const first = slide.slotGroups[0];
  const slotLine = first
    ? `${first.dayKey === "today" ? t("slotsToday") : t("slotsTomorrow")} · ${first.times.slice(0, 2).join(", ")}`
    : "";

  return (
    <article
      className={cn(
        "mx-auto w-full min-w-0 max-w-[8.25rem] overflow-hidden rounded-2xl border border-border/40 bg-muted/15",
        className,
      )}
    >
      <div className="relative aspect-square w-full">
        <Image
          src={slide.imageSrc}
          alt={partnerField(t, slide.id, "imageAlt")}
          fill
          className="object-cover object-center"
          sizes="(max-width: 640px) 62vw, (max-width: 1024px) 28vw, 22vw"
        />
        <p className="absolute left-1.5 top-1.5 max-w-[calc(100%-0.75rem)] truncate rounded bg-background/92 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-foreground">
          {t("sliderCardTag")}
        </p>
      </div>
      <div className="space-y-0.5 px-2 pb-1.5 pt-1">
        <div className="flex items-start justify-between gap-1">
          <h3 className="min-w-0 flex-1 truncate font-heading text-sm font-semibold leading-tight tracking-tight text-foreground">
            {partnerField(t, slide.id, "name")}
          </h3>
          <span className="shrink-0 pt-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
            ★{slide.rating.toFixed(1)}
          </span>
        </div>
        <p className="line-clamp-1 text-[11px] leading-snug text-muted-foreground">
          {partnerField(t, slide.id, "meta")}
        </p>
        <p className="line-clamp-1 text-[10px] font-medium leading-snug text-primary">
          {partnerField(t, slide.id, "services")}
        </p>
        {slotLine ? (
          <p className="line-clamp-1 text-[10px] text-muted-foreground/90">
            {slotLine}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function SalonRow({ row, t }: { row: LandingSalonRowSeed; t: Translate }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-border/50 bg-muted/20 p-3">
      <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl">
        <Image
          src={row.imageSrc}
          alt={salonField(t, row.id, "imageAlt")}
          width={64}
          height={64}
          className="size-full object-cover object-center"
        />
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {t("salonsRowLabel")}
        </p>
        <h3 className="mt-0.5 font-heading text-sm font-semibold tracking-tight text-foreground">
          {salonField(t, row.id, "name")}
        </h3>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
          {salonField(t, row.id, "city")}
        </p>
      </div>
    </div>
  );
}

export function BecomeSpecialistLandingBody({
  t,
  mailtoHref,
  contactEmail,
}: {
  t: Translate;
  mailtoHref: string;
  contactEmail: string;
}) {
  const sectionTitleClass =
    "font-heading text-xl font-bold tracking-tight text-foreground sm:text-[1.3125rem]";

  return (
    <div className="space-y-8 sm:space-y-9">
      <section
        className="space-y-4"
        aria-labelledby="become-specialist-hero-heading"
      >
        <p className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.07] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
          <Sparkles className="size-3.5 shrink-0" aria-hidden />
          <span className="leading-tight">{t("badge")}</span>
        </p>
        <div className="space-y-2">
          <h1
            id="become-specialist-hero-heading"
            className="text-balance font-heading text-2xl font-bold leading-[1.15] tracking-tight text-foreground sm:text-[1.75rem] sm:leading-tight md:text-3xl"
          >
            {t("heroTitle")}
          </h1>
          <p className="max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
            {t("heroLead")}
          </p>
        </div>

        <div className="grid h-[min(58vw,15.5rem)] grid-cols-5 grid-rows-2 gap-2 sm:h-[17.5rem]">
          <div className="relative col-span-3 row-span-2 overflow-hidden rounded-2xl border border-border/40">
            <Image
              src={becomeSpecialistHeroImages.main}
              alt={t("heroMainAlt")}
              fill
              priority
              className="object-cover object-center"
              sizes="(max-width: 512px) 60vw, 320px"
            />
          </div>
          <div className="relative col-span-2 row-span-1 overflow-hidden rounded-2xl border border-border/40">
            <Image
              src={becomeSpecialistHeroImages.top}
              alt={t("heroTopAlt")}
              fill
              className="object-cover object-center"
              sizes="(max-width: 512px) 38vw, 200px"
            />
          </div>
          <div className="relative col-span-2 row-span-1 overflow-hidden rounded-2xl border border-border/40">
            <Image
              src={becomeSpecialistHeroImages.bottom}
              alt={t("heroBottomAlt")}
              fill
              className="object-cover object-center"
              sizes="(max-width: 512px) 38vw, 200px"
            />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <HeroAdvantage title={t("heroAdv1Title")} body={t("heroAdv1Body")} />
          <HeroAdvantage title={t("heroAdv2Title")} body={t("heroAdv2Body")} />
          <HeroAdvantage title={t("heroAdv3Title")} body={t("heroAdv3Body")} />
        </div>

        <div className="space-y-2">
          <Button
            variant="primary"
            className="h-12 w-full rounded-full text-base font-semibold shadow-none"
            asChild
          >
            <Link href="/registration">
              <UserPlus className="mr-2 size-5 shrink-0" aria-hidden />
              {t("heroCta")}
            </Link>
          </Button>
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            {t("heroCtaHint")}
          </p>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="become-specialist-slider-heading">
        <div className="min-w-0 space-y-1">
          <h2 id="become-specialist-slider-heading" className={sectionTitleClass}>
            {t("sliderHeading")}
          </h2>
          <p className="text-pretty text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {t("sliderSub")}
          </p>
        </div>
        <div className="-mx-4 min-w-0" role="region" aria-label={t("sliderAria")}>
          <Slider
            className="px-4"
            showDots={false}
            trackGapClassName="gap-2"
            trackGapPx={8}
            slideMinWidthClassName="min-w-0 w-[62%] sm:w-[calc((100%-0.5rem)/2)]"
            slides={landingSpecialistSlides.map((slide) => ({
              id: slide.id,
              content: (
                <div className="flex h-full min-w-0 w-full flex-col pb-0.5 pt-0.5">
                  <SpecialistSpotlightCard
                    slide={slide}
                    t={t}
                    className="mx-0 h-full min-w-0 max-w-none w-full flex-1"
                  />
                </div>
              ),
            }))}
          />
        </div>
        <div className="w-full pt-1">
          <Button
            variant="ghost"
            className="h-12 w-full rounded-full border border-border/80 text-base font-semibold text-foreground hover:bg-muted/30"
            asChild
          >
            <Link href="/search">{t("exploreAll")}</Link>
          </Button>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="become-specialist-salons-heading">
        <div className="space-y-1">
          <h2 id="become-specialist-salons-heading" className={sectionTitleClass}>
            {t("salonsHeading")}
          </h2>
          <p className="text-pretty text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {t("salonsSub")}
          </p>
        </div>
        <div className="space-y-2">
          {landingSalonRows.map((row) => (
            <SalonRow key={row.id} row={row} t={t} />
          ))}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="become-specialist-wyg-heading">
        <h2 id="become-specialist-wyg-heading" className={sectionTitleClass}>
          {t("wygHeading")}
        </h2>
        <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
          <WhatYouGetTile
            icon={BarChart3}
            title={t("wyg_analytics_title")}
            body={t("wyg_analytics_body")}
          />
          <WhatYouGetTile
            icon={CalendarDays}
            title={t("wyg_booking_title")}
            body={t("wyg_booking_body")}
          />
          <WhatYouGetTile
            icon={Megaphone}
            title={t("wyg_visibility_title")}
            body={t("wyg_visibility_body")}
          />
          <WhatYouGetTile
            icon={ShieldCheck}
            title={t("wyg_trust_title")}
            body={t("wyg_trust_body")}
          />
        </div>
      </section>

      <section
        className="relative overflow-hidden rounded-3xl border border-border/40"
        aria-labelledby="become-specialist-banner-heading"
      >
        <div className="absolute inset-0">
          <Image
            src={becomeSpecialistBannerImage}
            alt={t("bannerImageAlt")}
            fill
            className="object-cover object-center"
            sizes="(max-width: 512px) 100vw, 32rem"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-foreground/88 via-foreground/58 to-foreground/38"
            aria-hidden
          />
        </div>
        <div className="relative z-10 space-y-3 px-5 py-8 sm:px-7 sm:py-9">
          <h2
            id="become-specialist-banner-heading"
            className="max-w-md text-balance font-heading text-2xl font-bold leading-tight tracking-tight text-primary-foreground sm:text-[1.65rem]"
          >
            {t("bannerTitle")}
          </h2>
          <p className="max-w-md text-pretty text-sm leading-relaxed text-primary-foreground/92">
            {t("bannerBody")}
          </p>
          <Button
            variant="secondary"
            tone="light"
            className="h-12 w-full rounded-full text-base font-semibold sm:w-auto sm:min-w-[13rem] sm:px-10"
            asChild
          >
            <Link href="/registration">{t("bannerCta")}</Link>
          </Button>
        </div>
      </section>

      <footer
        className="space-y-3 rounded-3xl border border-border/50 bg-muted/25 px-4 py-5 sm:px-5"
        aria-label={t("contactAria")}
      >
        <h2 className="font-heading text-lg font-bold tracking-tight text-foreground">
          {t("footerHeading")}
        </h2>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("footerEmailLabel")}
            </dt>
            <dd className="mt-1">
              <a
                href={mailtoHref}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                {contactEmail}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("footerHoursLabel")}
            </dt>
            <dd className="mt-1 text-muted-foreground">{t("footerHours")}</dd>
          </div>
          <div>
            <dt className="sr-only">{t("footerNoteLabel")}</dt>
            <dd className="text-xs leading-relaxed text-muted-foreground">
              {t("footerNote")}
            </dd>
          </div>
        </dl>
      </footer>
    </div>
  );
}
