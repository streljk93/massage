import { getTranslations } from "next-intl/server";
import { ScanLine, Search as SearchIcon } from "lucide-react";
import { CategoryCard } from "@/entities/services";
import { BookingCard } from "@/entities/booking";
import { OrganizationCard } from "@/entities/organizations";
import { SpecialistCard } from "@/entities/specialists";
import { Link } from "@/i18n/navigation";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Slider } from "@/shared/ui/slider";
import { HomeBottomNav } from "./home-bottom-nav";
import { HomeScreenHeader } from "./home-screen-header";
import {
  categories,
  currentBooking,
  homeUser,
  promoSlides,
  topSalons,
  topSpecialists,
} from "../lib/mock-data";

function PromoSlide({
  title,
  subtitle,
  cta,
  imageSrc,
}: {
  title: string;
  subtitle: string;
  cta: string;
  imageSrc: string;
}) {
  return (
    <div className="flex min-h-[9.5rem] flex-1 flex-row overflow-hidden rounded-2xl bg-muted">
      <div className="flex flex-1 flex-col justify-center gap-2 p-4 sm:gap-3">
        <h2 className="font-heading text-xl font-bold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
        <Button variant="primary" className="mt-1 w-fit rounded-xl px-5">
          {cta}
        </Button>
      </div>
      <div className="relative w-[38%] max-w-[9rem] shrink-0 sm:max-w-none sm:flex-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      </div>
    </div>
  );
}

function translateSlotLabel(label: string, t: (key: string) => string) {
  return label.toLowerCase() === "today" ? t("slots.today") : label;
}

export async function HomeScreen() {
  const t = await getTranslations();

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface-background">
      <main className="mx-auto w-full max-w-lg flex-1 space-y-6 px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <HomeScreenHeader
          locationLabel={homeUser.locationLabel}
          title={t("home.welcome", { name: homeUser.firstName })}
          avatarSrc={homeUser.avatarSrc}
          avatarAlt={homeUser.firstName}
          avatarFallback={homeUser.firstName.slice(0, 2).toUpperCase()}
        />

        <Slider
          slides={promoSlides.map((p) => ({
            id: p.id,
            content: (
              <PromoSlide
                title={t(p.titleKey)}
                subtitle={t(p.subtitleKey)}
                cta={t(p.ctaKey)}
                imageSrc={p.imageSrc}
              />
            ),
          }))}
        />

        <Link
          href="/search"
          className="block w-full"
          aria-label={t("home.searchAriaLabel")}
        >
          <Input
            readOnly
            tabIndex={-1}
            placeholder={t("home.searchPlaceholder")}
            startAdornment={<SearchIcon className="size-4" aria-hidden />}
            endAdornment={
              <ScanLine className="size-5 text-muted-foreground" aria-hidden />
            }
            className="h-11 cursor-pointer rounded-full border-0 bg-surface-light"
          />
        </Link>

        <section aria-labelledby="categories-heading">
          <h2 id="categories-heading" className="sr-only">
            {t("home.categoriesHeading")}
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((c) => (
              <CategoryCard
                key={c.id}
                label={t(c.labelKey)}
                icon={<span className="text-2xl">{c.emoji}</span>}
              />
            ))}
          </div>
        </section>

        <section className="space-y-3" aria-labelledby="booking-heading">
          <h2
            id="booking-heading"
            className="font-heading text-lg font-semibold tracking-tight"
          >
            {t("home.yourBooking")}
          </h2>
          <BookingCard
            specialistName={currentBooking.specialistName}
            serviceLine={currentBooking.serviceLine}
            dateLabel={t("booking.today")}
            timeRange={currentBooking.timeRange}
            avatarSrc={currentBooking.avatarSrc}
          />
        </section>

        <section className="space-y-3" aria-labelledby="salons-heading">
          <h2
            id="salons-heading"
            className="font-heading text-lg font-semibold tracking-tight"
          >
            {t("home.topSalons")}
          </h2>
          <div className="space-y-3">
            {topSalons.map((s) => (
              <OrganizationCard
                key={s.id}
                {...s}
                imageAlt={s.name}
                slotLabels={s.slotLabels.map((l) => translateSlotLabel(l, t))}
              />
            ))}
          </div>
          <Button
            variant="secondary"
            tone="light"
            className="h-11 w-full rounded-full font-medium"
          >
            {t("home.seeAll")}
          </Button>
        </section>

        <section className="space-y-3" aria-labelledby="specialists-heading">
          <h2
            id="specialists-heading"
            className="font-heading text-lg font-semibold tracking-tight"
          >
            {t("home.topSpecialists")}
          </h2>
          <div className="space-y-3">
            {topSpecialists.map((s) => (
              <SpecialistCard
                key={s.id}
                {...s}
                imageAlt={s.name}
                slotLabels={s.slotLabels.map((l) => translateSlotLabel(l, t))}
              />
            ))}
          </div>
          <Button
            variant="secondary"
            tone="light"
            className="mb-2 h-11 w-full rounded-full font-medium"
          >
            {t("home.seeAll")}
          </Button>
        </section>
      </main>

      <HomeBottomNav activeId="home" />
    </div>
  );
}
