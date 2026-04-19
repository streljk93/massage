import { MapPin } from "lucide-react";
import { CategoryCard } from "@/entities/services";
import { BookingCard } from "@/entities/booking";
import { OrganizationCard } from "@/entities/organizations";
import { SpecialistCard } from "@/entities/specialists";
import { UserAvatar } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Slider } from "@/shared/ui/slider";
import { SpecialistSearch } from "@/entities/specialists";
import { HomeBottomNav } from "./home-bottom-nav";
import {
  categories,
  currentBooking,
  homeUser,
  promoSlides,
  specialistSearchOptions,
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
    <div className="flex min-h-[9.5rem] flex-row overflow-hidden rounded-2xl bg-muted">
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

export function HomeScreen() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface-background">
      <main className="mx-auto w-full max-w-lg flex-1 space-y-6 px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              {homeUser.locationLabel}
            </p>
            <h1 className="font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Welcome, {homeUser.firstName}
            </h1>
          </div>
          <UserAvatar
            src={homeUser.avatarSrc}
            alt={homeUser.firstName}
            fallback={homeUser.firstName.slice(0, 2).toUpperCase()}
            size="lg"
          />
        </header>

        <Slider
          slides={promoSlides.map((p) => ({
            id: p.id,
            content: (
              <PromoSlide
                title={p.title}
                subtitle={p.subtitle}
                cta={p.cta}
                imageSrc={p.imageSrc}
              />
            ),
          }))}
        />

        <SpecialistSearch options={specialistSearchOptions} />

        <section aria-labelledby="categories-heading">
          <h2 id="categories-heading" className="sr-only">
            Категории массажа
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((c) => (
              <CategoryCard
                key={c.id}
                label={c.label}
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
            Your booking
          </h2>
          <BookingCard
            specialistName={currentBooking.specialistName}
            serviceLine={currentBooking.serviceLine}
            dateLabel={currentBooking.dateLabel}
            timeRange={currentBooking.timeRange}
            avatarSrc={currentBooking.avatarSrc}
          />
        </section>

        <section className="space-y-3" aria-labelledby="salons-heading">
          <h2
            id="salons-heading"
            className="font-heading text-lg font-semibold tracking-tight"
          >
            Top Salons
          </h2>
          <div className="space-y-3">
            {topSalons.map((s) => (
              <OrganizationCard key={s.id} {...s} imageAlt={s.name} />
            ))}
          </div>
          <Button
            variant="secondary"
            tone="light"
            className="h-11 w-full rounded-full font-medium"
          >
            See all
          </Button>
        </section>

        <section className="space-y-3" aria-labelledby="specialists-heading">
          <h2
            id="specialists-heading"
            className="font-heading text-lg font-semibold tracking-tight"
          >
            Top specialists
          </h2>
          <div className="space-y-3">
            {topSpecialists.map((s) => (
              <SpecialistCard key={s.id} {...s} imageAlt={s.name} />
            ))}
          </div>
          <Button
            variant="secondary"
            tone="light"
            className="mb-2 h-11 w-full rounded-full font-medium"
          >
            See all
          </Button>
        </section>
      </main>

      <HomeBottomNav activeId="home" />
    </div>
  );
}
