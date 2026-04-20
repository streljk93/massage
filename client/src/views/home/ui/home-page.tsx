import { getFormatter, getTranslations } from "next-intl/server";
import { ScanLine, Search as SearchIcon } from "lucide-react";
import { CategoryCard } from "@/entities/services";
import {
  BookingCard,
  formatBookingServiceLine,
} from "@/entities/booking";
import { OrganizationCard } from "@/entities/organizations";
import { SpecialistCard } from "@/entities/specialists";
import { Link } from "@/app/i18n/navigation";
import type { AvailabilitySlotGroup } from "@/shared/ui";
import { Button } from "@/shared/ui/button";
import { Slider } from "@/shared/ui/slider";
import { cn } from "@/shared/lib";
import {
  HomeBottomNav,
  HomeScreenHeader,
} from "@/widgets/home";
import {
  categories,
  currentBooking,
  homeUser,
  promoSlides,
  topSalons,
  topSpecialists,
  type SlotGroupSeed,
} from "@/widgets/home/lib/mock-data";

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

function slotGroupsFromSeed(
  groups: SlotGroupSeed[],
  t: (key: string) => string,
): AvailabilitySlotGroup[] {
  return groups.map((g) => ({
    dayLabel:
      g.dayKey === "today" ? t("slots.today") : t("slots.tomorrow"),
    times: g.times,
  }));
}

export async function HomePage() {
  const t = await getTranslations();
  const format = await getFormatter();

  return (
    <div className="flex min-h-screen flex-col bg-surface-background">
      <div className="flex min-h-0 flex-1 flex-col">
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
            <div
              className={cn(
                "relative flex h-11 w-full min-w-0 cursor-pointer items-center rounded-full border-0 bg-surface-light pl-11 pr-12 text-base motion-interactive outline-none md:text-sm",
              )}
            >
              <span
                className="pointer-events-none absolute top-1/2 left-3.5 flex size-4 -translate-y-1/2 items-center justify-center text-muted-foreground"
                aria-hidden
              >
                <SearchIcon className="size-4" />
              </span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {t("home.searchPlaceholder")}
              </span>
              <span className="pointer-events-none absolute top-1/2 right-2 flex -translate-y-1/2 items-center">
                <ScanLine className="size-5 text-muted-foreground" aria-hidden />
              </span>
            </div>
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
              serviceLine={formatBookingServiceLine(t, format, {
                serviceLabel: t(currentBooking.service.nameKey),
                amount: currentBooking.service.amount,
                currency: currentBooking.service.currency,
              })}
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
                  slotGroups={slotGroupsFromSeed(s.slotGroups, t)}
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
                  slotGroups={slotGroupsFromSeed(s.slotGroups, t)}
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
    </div>
  );
}
