import { getLocale, getTranslations } from "next-intl/server";
import type { AppLocale } from "@/app/i18n/routing";
import { ScanLine, Search as SearchIcon } from "lucide-react";
import { CategoryCard } from "@/entities/services";
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
  consumerPageMainClass,
  consumerPageRootClass,
} from "@/widgets/home";
import { CATALOG_MAJOR_CATEGORY_SLUG } from "@/shared/config/catalog-major-category";
import { massageCategoryEmoji } from "@/widgets/home/lib/category-emoji";
import { HomeCurrentBookingSection } from "./home-current-booking-section";
import { HomeForYouSection } from "./home-for-you-section";
import {
  HomeTopOrganizationCards,
  HomeTopSpecialistCards,
} from "./home-top-directory-section-cards";
import { homeUser, promoSlides } from "@/widgets/home/lib/mock-data";
import { searchTabQueryValue } from "@/shared/lib/search-tab";

function isAbsoluteHttpUrl(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/** Как у {@link HomeTopNav}: полупрозрачная заливка + blur. */
const promoGlassPanelClass = cn(
  "border-border/80 bg-background/75 backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-background/55",
  "dark:border-border/85 dark:supports-[backdrop-filter]:bg-background/45",
);

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
  const ctaClassName =
    "mt-1 w-fit rounded-xl px-5 lg:mt-2 lg:h-11 lg:px-6 lg:text-base";

  const ctaButton =
    ctaHref ?
      isAbsoluteHttpUrl(ctaHref) ?
        <Button variant="primary" className={ctaClassName} asChild>
          <a href={ctaHref} target="_blank" rel="noopener noreferrer">
            {cta}
          </a>
        </Button>
      : <Button variant="primary" className={ctaClassName} asChild>
          <Link href={ctaHref}>{cta}</Link>
        </Button>
    : <Button variant="primary" className={ctaClassName}>
        {cta}
      </Button>;

  return (
    <div className="relative min-h-[9.5rem] overflow-hidden rounded-2xl md:min-h-[11rem] lg:min-h-[18rem] lg:rounded-3xl xl:min-h-[20rem]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageSrc}
        alt=""
        className="absolute inset-0 size-full object-cover"
      />
      <div
        className={cn(
          promoGlassPanelClass,
          "absolute inset-y-0 left-0 z-[1] flex w-[min(100%,18rem)] flex-col justify-center gap-2 border-r p-4 sm:gap-3 sm:w-[min(100%,20rem)] lg:w-[min(100%,22rem)] lg:gap-4 lg:p-8 xl:w-[min(100%,26rem)] xl:p-10",
        )}
      >
        <h2 className="font-heading text-xl font-bold tracking-tight text-foreground lg:text-3xl lg:leading-tight xl:text-[2rem]">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground lg:text-base lg:leading-relaxed">
          {subtitle}
        </p>
        {ctaButton}
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
  const locale = (await getLocale()) as AppLocale;

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
    <div className={consumerPageRootClass()}>
      <div className="flex min-h-0 flex-1 flex-col">
        <main className={consumerPageMainClass("space-y-3")}>
          <HomeScreenHeader
            title={t("home.welcome", { name: homeUser.firstName })}
            titleVariant="greeting"
            avatarAlt={homeUser.firstName}
            avatarFallback={homeUser.firstName.slice(0, 2).toUpperCase()}
          />

          <Slider
            className="lg:mt-1"
            dotsPlacement="overlay"
            dotsOverlayVariant="onMedia"
            dotsOverlayContainerClassName="lg:bottom-4"
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
              <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-6 lg:gap-2 lg:overflow-visible xl:grid-cols-8">
                {categoryChips.map((c) => (
                  <CategoryCard
                    key={c.key}
                    href={c.href}
                    label={c.label}
                    icon={c.emoji}
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
            <HomeTopSpecialistCards list={specialistsFromApi ?? []} />
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
            <HomeTopOrganizationCards list={organizationsFromApi ?? []} />
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
