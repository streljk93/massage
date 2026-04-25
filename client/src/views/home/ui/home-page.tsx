import { getLocale, getTranslations } from "next-intl/server";
import type { AppLocale } from "@/app/i18n/routing";
import { ScanLine, Search as SearchIcon } from "lucide-react";
import { CategoryCard } from "@/entities/services";
import { OrganizationCard } from "@/entities/organizations";
import { SpecialistCard } from "@/entities/specialists";
import { Link } from "@/app/i18n/navigation";
import { Button } from "@/shared/ui/button";
import { Slider } from "@/shared/ui/slider";
import { cn } from "@/shared/lib";
import {
  advertisingListByPlacement,
  catalogGetCategoriesByMajorSlug,
  createServerSdkClient,
  fetchOrganizationsListLimited,
  fetchSpecialistsListLimited,
  serverSdkFetchNoStore,
  type CatalogGetCategoriesByMajorSlugResponse,
  type OrganizationsListResponse,
  type SpecialistsListResponse,
} from "@/shared/api";
import {
  HomeBottomNav,
  HomeScreenHeader,
} from "@/widgets/home";
import { organizationCardSeedFromApi } from "@/entities/organizations";
import { specialistCardSeedFromApi } from "@/entities/specialists";
import { CATALOG_MAJOR_CATEGORY_SLUG } from "@/shared/config/catalog-major-category";
import { massageCategoryEmoji } from "@/widgets/home/lib/category-emoji";
import { HomeCurrentBookingSection } from "./home-current-booking-section";
import { HomeForYouSection } from "./home-for-you-section";
import { homeUser, promoSlides } from "@/widgets/home/lib/mock-data";
import { slotGroupsFromSeed } from "@/widgets/home/lib/slot-groups-from-seed";
import { searchTabQueryValue } from "@/shared/lib/search-tab";

function isAbsoluteHttpUrl(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function PromoSlide({
  title,
  subtitle,
  cta,
  imageSrc,
  ctaHref,
}: {
  title: string;
  subtitle: string;
  cta: string;
  imageSrc: string;
  ctaHref?: string | null;
}) {
  const ctaButton =
    ctaHref ?
      isAbsoluteHttpUrl(ctaHref) ?
        <Button variant="primary" className="mt-1 w-fit rounded-xl px-5" asChild>
          <a href={ctaHref} target="_blank" rel="noopener noreferrer">
            {cta}
          </a>
        </Button>
      : <Button variant="primary" className="mt-1 w-fit rounded-xl px-5" asChild>
          <Link href={ctaHref}>{cta}</Link>
        </Button>
    : <Button variant="primary" className="mt-1 w-fit rounded-xl px-5">
        {cta}
      </Button>;

  return (
    <div className="flex min-h-[9.5rem] flex-1 flex-row overflow-hidden rounded-2xl bg-muted">
      <div className="flex flex-1 flex-col justify-center gap-2 p-4 sm:gap-3">
        <h2 className="font-heading text-xl font-bold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
        {ctaButton}
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

/** Совпадает с `ADV_PLACEMENT_HOME_PROMO` в `back/prisma/seed-advertising.mjs`. */
const HOME_PROMO_PLACEMENT = "home_promo" as const;

/** Сколько карточек запрашивать у API для блоков «топ» на главной. */
const HOME_DIRECTORY_HIGHLIGHT_LIMIT = 3;

export async function HomePage() {
  const t = await getTranslations();
  const tSlots = await getTranslations("slots");
  const locale = (await getLocale()) as AppLocale;
  const listingNow = new Date();

  const sdkClient = createServerSdkClient();
  let catalog: CatalogGetCategoriesByMajorSlugResponse | null = null;
  let promoFromApi: Array<{
    id: string;
    title: string;
    subtitle: string;
    cta: string;
    imageSrc: string;
    ctaHref: string | null;
  }> | null = null;

  let specialistsFromApi: SpecialistsListResponse["specialists"] | null =
    null;
  let organizationsFromApi: OrganizationsListResponse["organizations"] | null =
    null;

  if (sdkClient) {
    const { data, error } = await catalogGetCategoriesByMajorSlug({
      client: sdkClient,
      path: { majorSlug: CATALOG_MAJOR_CATEGORY_SLUG },
      query: { locale, listedInDirectory: true },
    });
    if (!error && data) {
      catalog = data;
    }

    const ads = await advertisingListByPlacement({
      client: sdkClient,
      query: { placement: HOME_PROMO_PLACEMENT, locale },
      fetch: serverSdkFetchNoStore,
    });
    if (!ads.error && ads.data?.items?.length) {
      promoFromApi = ads.data.items.map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        cta: item.ctaLabel,
        imageSrc: item.imageUrl,
        ctaHref: item.targetUrl,
      }));
    }

    try {
      const [specs, orgs] = await Promise.all([
        fetchSpecialistsListLimited({
          client: sdkClient,
          locale,
          limit: HOME_DIRECTORY_HIGHLIGHT_LIMIT,
          fetch: serverSdkFetchNoStore,
        }),
        fetchOrganizationsListLimited({
          client: sdkClient,
          locale,
          limit: HOME_DIRECTORY_HIGHLIGHT_LIMIT,
          fetch: serverSdkFetchNoStore,
        }),
      ]);
      specialistsFromApi = specs;
      organizationsFromApi = orgs;
    } catch {
      specialistsFromApi = null;
      organizationsFromApi = null;
    }
  }

  const promoSlidesResolved =
    promoFromApi ??
    promoSlides.map((p) => ({
      id: p.id,
      title: t(p.titleKey),
      subtitle: t(p.subtitleKey),
      cta: t(p.ctaKey),
      imageSrc: p.imageSrc,
      ctaHref: null as string | null,
    }));

  const categoryChips =
    catalog?.categories?.length ?
      catalog.categories.map((c, index) => ({
        key: c.id,
        label: c.shortName,
        emoji: massageCategoryEmoji(c.slug, index),
        href: `/search?category=${encodeURIComponent(c.slug)}`,
      }))
    : [];

  return (
    <div className="flex min-h-screen flex-col bg-surface-background">
      <div className="flex min-h-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-lg flex-1 space-y-3 px-4 pt-3 pb-[calc(5rem+env(safe-area-inset-bottom))]">
          <HomeScreenHeader
            title={t("home.welcome", { name: homeUser.firstName })}
            titleVariant="greeting"
            avatarAlt={homeUser.firstName}
            avatarFallback={homeUser.firstName.slice(0, 2).toUpperCase()}
          />

          <Slider
            dotsPlacement="overlay"
            dotsAriaLabel={t("home.promoSliderDotsAria")}
            slides={promoSlidesResolved.map((p) => ({
              id: p.id,
              content: (
                <PromoSlide
                  title={p.title}
                  subtitle={p.subtitle}
                  cta={p.cta}
                  imageSrc={p.imageSrc}
                  ctaHref={p.ctaHref}
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

          {categoryChips.length > 0 ?
            <section aria-labelledby="categories-heading">
              <h2 id="categories-heading" className="sr-only">
                {t("home.categoriesHeading")}
              </h2>
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {categoryChips.map((c) => (
                  <CategoryCard
                    key={c.key}
                    href={c.href}
                    label={c.label}
                    icon={<span className="text-2xl">{c.emoji}</span>}
                  />
                ))}
              </div>
            </section>
          : null}

          <HomeCurrentBookingSection />

          <HomeForYouSection />

          <section className="space-y-2.5" aria-labelledby="specialists-heading">
            <h2
              id="specialists-heading"
              className="font-heading text-lg font-semibold tracking-tight"
            >
              {t("home.topSpecialists")}
            </h2>
            <div className="space-y-2.5">
              {(specialistsFromApi ?? []).map((s) => {
                const card = specialistCardSeedFromApi(s);
                return (
                  <SpecialistCard
                    key={card.id}
                    {...card}
                    imageAlt={card.name}
                    profileHref={`/specialists/${s.id}`}
                    slotGroups={slotGroupsFromSeed(card.slotGroups, tSlots, {
                      locale,
                      maxGroups: 5,
                      now: listingNow,
                    })}
                  />
                );
              })}
            </div>
            <Button
              variant="secondary"
              tone="light"
              className="h-11 w-full rounded-full font-medium"
              asChild
            >
              <Link
                href={`/search?tab=${searchTabQueryValue("specialists")}`}
              >
                {t("home.seeAll")}
              </Link>
            </Button>
          </section>

          <section className="space-y-2.5" aria-labelledby="salons-heading">
            <h2
              id="salons-heading"
              className="font-heading text-lg font-semibold tracking-tight"
            >
              {t("home.topSalons")}
            </h2>
            <div className="space-y-2.5">
              {(organizationsFromApi ?? []).map((o) => {
                const card = organizationCardSeedFromApi(o);
                return (
                  <OrganizationCard
                    key={card.id}
                    {...card}
                    imageAlt={card.name}
                    profileHref={`/organizations/${o.id}`}
                    slotGroups={slotGroupsFromSeed(card.slotGroups, tSlots, {
                      locale,
                      maxGroups: 5,
                      now: listingNow,
                    })}
                  />
                );
              })}
            </div>
            <Button
              variant="secondary"
              tone="light"
              className="mb-2 h-11 w-full rounded-full font-medium"
              asChild
            >
              <Link
                href={`/search?tab=${searchTabQueryValue("organizations")}`}
              >
                {t("home.seeAll")}
              </Link>
            </Button>
          </section>
        </main>

        <HomeBottomNav activeId="home" />
      </div>
    </div>
  );
}
