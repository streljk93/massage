/**
 * Реклама: идемпотентный upsert по `refKey`.
 * Карусель главной (`home_promo`) — те же тексты и изображения, что в
 * `client/src/views/home/model/home-page.i18n.json` и `promoSlides` в mock-data.
 */
export const ADV_PLACEMENT_HOME_PROMO = 'home_promo';

const homePromoSpecs = [
  {
    refKey: 'adv_home_promo_0',
    sortOrder: 0,
    imageUrl:
      'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=400&h=300&fit=crop',
    targetUrl: null,
    ownerKind: 'internal',
    canonical: {
      title: 'Discount 25%',
      subtitle: 'For new clients',
      ctaLabel: 'Sign up',
    },
    locales: {
      en: {
        title: 'Discount 25%',
        subtitle: 'For new clients',
        ctaLabel: 'Sign up',
      },
      vi: {
        title: 'Giảm 25%',
        subtitle: 'Cho khách hàng mới',
        ctaLabel: 'Đăng ký',
      },
      ru: {
        title: 'Скидка 25%',
        subtitle: 'Новым клиентам',
        ctaLabel: 'Регистрация',
      },
    },
  },
  {
    refKey: 'adv_home_promo_1',
    sortOrder: 1,
    imageUrl:
      'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=300&fit=crop',
    targetUrl: null,
    ownerKind: 'internal',
    canonical: {
      title: 'Free hot stone',
      subtitle: 'Book this week',
      ctaLabel: 'Book now',
    },
    locales: {
      en: {
        title: 'Free hot stone',
        subtitle: 'Book this week',
        ctaLabel: 'Book now',
      },
      vi: {
        title: 'Đá nóng miễn phí',
        subtitle: 'Đặt trong tuần này',
        ctaLabel: 'Đặt ngay',
      },
      ru: {
        title: 'Горячий камень в подарок',
        subtitle: 'Запишитесь на этой неделе',
        ctaLabel: 'Записаться',
      },
    },
  },
  {
    refKey: 'adv_home_promo_2',
    sortOrder: 2,
    imageUrl:
      'https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=400&h=300&fit=crop',
    targetUrl: null,
    ownerKind: 'internal',
    canonical: {
      title: 'Evening special',
      subtitle: '15% off bookings after 6 PM',
      ctaLabel: 'Browse',
    },
    locales: {
      en: {
        title: 'Evening special',
        subtitle: '15% off bookings after 6 PM',
        ctaLabel: 'Browse',
      },
      vi: {
        title: 'Ưu đãi buổi tối',
        subtitle: 'Giảm 15% cho lịch sau 18h',
        ctaLabel: 'Xem lịch',
      },
      ru: {
        title: 'Вечерняя акция',
        subtitle: 'Скидка 15% на записи после 18:00',
        ctaLabel: 'Смотреть',
      },
    },
  },
];

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 */
export async function seedAdvertising(prisma) {
  for (const spec of homePromoSpecs) {
    const localeRows = Object.entries(spec.locales).map(([locale, t]) => ({
      locale,
      title: t.title,
      subtitle: t.subtitle,
      ctaLabel: t.ctaLabel,
    }));

    await prisma.advertisement.upsert({
      where: { refKey: spec.refKey },
      create: {
        refKey: spec.refKey,
        placement: ADV_PLACEMENT_HOME_PROMO,
        ownerKind: spec.ownerKind,
        sortOrder: spec.sortOrder,
        isActive: true,
        title: spec.canonical.title,
        subtitle: spec.canonical.subtitle,
        ctaLabel: spec.canonical.ctaLabel,
        imageUrl: spec.imageUrl,
        targetUrl: spec.targetUrl,
        locales: {
          create: localeRows,
        },
      },
      update: {
        placement: ADV_PLACEMENT_HOME_PROMO,
        ownerKind: spec.ownerKind,
        sortOrder: spec.sortOrder,
        isActive: true,
        title: spec.canonical.title,
        subtitle: spec.canonical.subtitle,
        ctaLabel: spec.canonical.ctaLabel,
        imageUrl: spec.imageUrl,
        targetUrl: spec.targetUrl,
      },
    });

    const ad = await prisma.advertisement.findUniqueOrThrow({
      where: { refKey: spec.refKey },
    });

    await prisma.advertisementLocale.deleteMany({
      where: { advertisementId: ad.id },
    });
    await prisma.advertisementLocale.createMany({
      data: localeRows.map((row) => ({
        advertisementId: ad.id,
        ...row,
      })),
    });
  }

  console.log(
    `[seed] Advertisements: placement=${ADV_PLACEMENT_HOME_PROMO}, refs=${homePromoSpecs.map((s) => s.refKey).join(', ')}.`,
  );
}
