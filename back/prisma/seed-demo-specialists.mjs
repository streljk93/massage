/**
 * Демо-мастера и организации: базовая пара владелец+сотрудник в `demo-salon-seed`, затем
 * доведение этого салона до ≥5 специалистов и ещё 5 салонов (`demo-salon-seed-2` … `6`):
 * у каждого салона владелец (owner) и всего ≥5 мастеров.
 *
 * Гео (Phú Quốc + карта), категории, отзывы/рейтинги (`applyDemoDirectoryReviewPack`),
 * listedInDirectory (владелец в каталоге мастеров — скрыт, сотрудники — да).
 * Инвариант демо: у мастера число `Service` с `specialistId` = числу строк в
 * `SpecialistServiceCategory` (одна услуга на выбранную подкатегорию).
 * Клиенты-авторы отзывов: нейтральные имена, email `demo.client.*@example.com` (без бренда салона).
 * Идемпотентно: фиксированные email/slug. Пароль (демо): `Demo123456!` — bcrypt 12 раундов.
 */
import bcrypt from 'bcrypt';
import { OrganizationMembershipRole } from '@prisma/client';

const SALT_ROUNDS = 12;

/**
 * График витрины (минуты с полуночи, VN) — у каждого демо-салона разный, как в жизни:
 * кто-то с 8:00, кто-то с 9/10, закрытие 21/22/23.
 */
const LISTING_WORKDAY_PRESETS = [
  { start: 8 * 60, end: 22 * 60 },
  { start: 9 * 60, end: 21 * 60 },
  { start: 10 * 60, end: 23 * 60 },
  { start: 8 * 60, end: 21 * 60 },
  { start: 9 * 60, end: 23 * 60 },
  { start: 10 * 60, end: 22 * 60 },
];

const DEMO_PASSWORD = 'Demo123456!';

const OWNER_EMAIL = 'demo.salon.owner@example.com';
const WORKER_EMAIL = 'demo.salon.worker@example.com';
/** «Клиенты» для отзывов: нейтральные имена, без привязки к бренду салонов. */
const CLIENT_REVIEW_EMAIL = 'demo.client.mai@example.com';
const CLIENT_REVIEW_EMAIL_2 = 'demo.client.duc@example.com';
const CLIENT_REVIEW_EMAIL_3 = 'demo.client.hoang@example.com';
const CLIENT_REVIEW_EMAIL_4 = 'demo.client.phuong@example.com';
const ORG_SLUG = 'demo-salon-seed';

/** Phú Quốc, Dương Đông — демо на острове (карта / адрес). */
const ORG_LAT = 10.216_5;
const ORG_LNG = 103.963_5;
/**
 * Вторая строка карточки из выбранных подкатегорий (канонический shortName в БД = en).
 * @param {{ shortName: string }[]} cats
 */
function listingServicesLineFromCategories(cats) {
  if (!cats.length) return null;
  return cats.map((c) => c.shortName).join(' · ');
}

const AVATAR_POOL = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128&h=128&fit=crop',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=128&h=128&fit=crop',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=128&h=128&fit=crop',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=128&h=128&fit=crop',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&h=128&fit=crop',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=128&h=128&fit=crop',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=128&h=128&fit=crop',
];

function avatarForSeed(i) {
  return AVATAR_POOL[i % AVATAR_POOL.length];
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 */
export async function seedDemoSpecialists(prisma) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

  const ownerUser = await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    create: {
      email: OWNER_EMAIL,
      name: 'Демо владелец салона',
      passwordHash,
      locale: 'ru',
      phone: '+84901234567',
      avatarUrl:
        'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=128&h=128&fit=crop',
    },
    update: {
      name: 'Демо владелец салона',
      passwordHash,
      phone: '+84901234567',
      avatarUrl:
        'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=128&h=128&fit=crop',
    },
  });

  const workerUser = await prisma.user.upsert({
    where: { email: WORKER_EMAIL },
    create: {
      email: WORKER_EMAIL,
      name: 'Демо мастер (сотрудник)',
      passwordHash,
      locale: 'ru',
      phone: '+84907654321',
      avatarUrl:
        'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=128&h=128&fit=crop',
    },
    update: {
      name: 'Демо мастер (сотрудник)',
      passwordHash,
      phone: '+84907654321',
      avatarUrl:
        'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=128&h=128&fit=crop',
    },
  });

  const clientReviewer = await prisma.user.upsert({
    where: { email: CLIENT_REVIEW_EMAIL },
    create: {
      email: CLIENT_REVIEW_EMAIL,
      name: 'Mai Lê',
      passwordHash: null,
      locale: 'vi',
      phone: '+84901112233',
      avatarUrl:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop',
    },
    update: {
      name: 'Mai Lê',
      phone: '+84901112233',
      avatarUrl:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop',
    },
  });

  const clientReviewer2 = await prisma.user.upsert({
    where: { email: CLIENT_REVIEW_EMAIL_2 },
    create: {
      email: CLIENT_REVIEW_EMAIL_2,
      name: 'Đức Phạm',
      passwordHash: null,
      locale: 'vi',
      phone: '+84904445566',
      avatarUrl:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128&h=128&fit=crop',
    },
    update: {
      name: 'Đức Phạm',
      phone: '+84904445566',
      avatarUrl:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128&h=128&fit=crop',
    },
  });

  const clientReviewer3 = await prisma.user.upsert({
    where: { email: CLIENT_REVIEW_EMAIL_3 },
    create: {
      email: CLIENT_REVIEW_EMAIL_3,
      name: 'Hoàng Văn Nam',
      passwordHash: null,
      locale: 'vi',
      phone: '+84905557788',
      avatarUrl: avatarForSeed(2),
    },
    update: {
      name: 'Hoàng Văn Nam',
      phone: '+84905557788',
      avatarUrl: avatarForSeed(2),
    },
  });

  const clientReviewer4 = await prisma.user.upsert({
    where: { email: CLIENT_REVIEW_EMAIL_4 },
    create: {
      email: CLIENT_REVIEW_EMAIL_4,
      name: 'Lê Phương Anh',
      passwordHash: null,
      locale: 'en',
      phone: '+84906668899',
      avatarUrl: avatarForSeed(3),
    },
    update: {
      name: 'Lê Phương Anh',
      phone: '+84906668899',
      avatarUrl: avatarForSeed(3),
    },
  });

  const ownerSpecialist = await prisma.specialist.upsert({
    where: { userId: ownerUser.id },
    create: {
      userId: ownerUser.id,
      bio: 'Владелец демо-салона, массажист.',
      experienceYears: 10,
      imageUrl:
        'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=200&h=200&fit=crop',
      listingMetaLine: '~ 500m from night market | Duong Dong, Phu Quoc',
      listingServicesLine: null,
      listedInDirectory: false,
    },
    update: {
      bio: 'Владелец демо-салона, массажист.',
      experienceYears: 10,
      imageUrl:
        'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=200&h=200&fit=crop',
      listingMetaLine: '~ 500m from night market | Duong Dong, Phu Quoc',
      listingServicesLine: null,
      listedInDirectory: false,
    },
  });

  const workerSpecialist = await prisma.specialist.upsert({
    where: { userId: workerUser.id },
    create: {
      userId: workerUser.id,
      bio: 'Мастер салона (сотрудник).',
      experienceYears: 5,
      imageUrl:
        'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop',
      listingMetaLine: '~ 1km from center | Duong Dong, Phu Quoc',
      listingServicesLine: null,
      listedInDirectory: true,
    },
    update: {
      bio: 'Мастер салона (сотрудник).',
      experienceYears: 5,
      imageUrl:
        'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop',
      listingMetaLine: '~ 1km from center | Duong Dong, Phu Quoc',
      listingServicesLine: null,
      listedInDirectory: true,
    },
  });

  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    create: {
      name: 'Демо-салон «Массаж»',
      slug: ORG_SLUG,
      ownerUserId: ownerUser.id,
      description: 'Сид для разработки: владелец и сотрудник.',
      city: 'Phú Quốc',
      addressLine: '118 Tran Hung Dao, Duong Dong',
      phone: '+842838220001',
      email: 'hello@demo-salon-seed.example.com',
      yearsInBusiness: 8,
      latitude: ORG_LAT,
      longitude: ORG_LNG,
      imageUrl:
        'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=200&h=200&fit=crop',
      listingMetaLine: '~ 500m from night market | Duong Dong, Phu Quoc',
      listingServicesLine: null,
      listingWorkdayStartMinute: LISTING_WORKDAY_PRESETS[0].start,
      listingWorkdayEndMinute: LISTING_WORKDAY_PRESETS[0].end,
    },
    update: {
      name: 'Демо-салон «Массаж»',
      ownerUserId: ownerUser.id,
      description: 'Сид для разработки: владелец и сотрудник.',
      city: 'Phú Quốc',
      addressLine: '118 Tran Hung Dao, Duong Dong',
      phone: '+842838220001',
      email: 'hello@demo-salon-seed.example.com',
      yearsInBusiness: 8,
      latitude: ORG_LAT,
      longitude: ORG_LNG,
      imageUrl:
        'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=200&h=200&fit=crop',
      listingMetaLine: '~ 500m from night market | Duong Dong, Phu Quoc',
      listingServicesLine: null,
      listingWorkdayStartMinute: LISTING_WORKDAY_PRESETS[0].start,
      listingWorkdayEndMinute: LISTING_WORKDAY_PRESETS[0].end,
    },
  });

  await ensureEmployment(
    prisma,
    ownerSpecialist.id,
    org.id,
    OrganizationMembershipRole.owner,
  );
  await ensureEmployment(
    prisma,
    workerSpecialist.id,
    org.id,
    OrganizationMembershipRole.specialist,
  );

  await prisma.specialist.update({
    where: { id: ownerSpecialist.id },
    data: { activeOrganizationId: org.id },
  });
  await prisma.specialist.update({
    where: { id: workerSpecialist.id },
    data: { activeOrganizationId: org.id },
  });

  const massageMajor = await prisma.majorServiceCategory.findUnique({
    where: { slug: 'massage' },
  });
  if (!massageMajor) {
    throw new Error('[seed-demo-specialists] major category massage not found');
  }

  const categorySlugs = [
    'neck',
    'back',
    'sports',
    'relaxing',
    'feet-reflexology',
    'body',
    'thai',
  ];
  const categories = await prisma.serviceCategory.findMany({
    where: {
      majorServiceCategoryId: massageMajor.id,
      slug: { in: categorySlugs },
    },
  });

  await prisma.organizationServiceCategory.deleteMany({
    where: { organizationId: org.id },
  });
  const bySlug = Object.fromEntries(categories.map((x) => [x.slug, x]));
  /** Все выбранные для витрины подкатегории (порядок как в `categorySlugs`). */
  const orgCategoryRows = categorySlugs.map((s) => bySlug[s]).filter(Boolean);
  for (const c of orgCategoryRows) {
    await prisma.organizationServiceCategory.create({
      data: { organizationId: org.id, serviceCategoryId: c.id },
    });
  }

  await prisma.specialistServiceCategory.deleteMany({
    where: {
      specialistId: { in: [ownerSpecialist.id, workerSpecialist.id] },
    },
  });
  const ownerPick = ['neck', 'back', 'sports']
    .map((s) => bySlug[s])
    .filter(Boolean);
  const workerPick = ['relaxing', 'feet-reflexology', 'neck']
    .map((s) => bySlug[s])
    .filter(Boolean);
  for (const c of ownerPick) {
    await prisma.specialistServiceCategory.create({
      data: {
        specialistId: ownerSpecialist.id,
        serviceCategoryId: c.id,
      },
    });
  }
  for (const c of workerPick) {
    await prisma.specialistServiceCategory.create({
      data: {
        specialistId: workerSpecialist.id,
        serviceCategoryId: c.id,
      },
    });
  }

  await prisma.organization.update({
    where: { id: org.id },
    data: {
      listingServicesLine: listingServicesLineFromCategories(orgCategoryRows),
    },
  });
  await prisma.specialist.update({
    where: { id: ownerSpecialist.id },
    data: {
      listingServicesLine: listingServicesLineFromCategories(ownerPick),
    },
  });
  await prisma.specialist.update({
    where: { id: workerSpecialist.id },
    data: {
      listingServicesLine: listingServicesLineFromCategories(workerPick),
    },
  });

  /** Услуги мастеров: `Service` + `ServicePriceOption` (60/90/120 мин) + `ServiceLocale`. */
  await prisma.service.deleteMany({
    where: {
      organizationId: org.id,
      slug: {
        in: [
          'demo-seed-owner-neck',
          'demo-seed-owner-back',
          'demo-seed-owner-sports',
          'demo-seed-worker-relax',
          'demo-seed-worker-foot',
          'demo-seed-worker-neck',
        ],
      },
    },
  });

  /**
   * По одной услуге на каждую привязанную к мастеру подкатегорию
   * (`SpecialistServiceCategory` — см. `ownerPick` / `workerPick` выше).
   */
  const serviceSeedRows = [
    {
      specialistId: ownerSpecialist.id,
      categorySlug: 'neck',
      slug: 'demo-seed-owner-neck',
      sortOrder: 0,
      priceTiers: [
        [30, 290_000],
        [45, 390_000],
        [60, 490_000],
      ],
      locales: {
        en: { name: 'Neck & shoulder massage' },
        vi: { name: 'Massage cổ và vai' },
        ru: { name: 'Массаж шеи и плеч' },
      },
    },
    {
      specialistId: ownerSpecialist.id,
      categorySlug: 'back',
      slug: 'demo-seed-owner-back',
      sortOrder: 1,
      priceTiers: [
        [60, 420_000],
        [90, 580_000],
        [120, 740_000],
      ],
      locales: {
        en: { name: 'Back massage' },
        vi: { name: 'Massage lưng' },
        ru: { name: 'Массаж спины' },
      },
    },
    {
      specialistId: ownerSpecialist.id,
      categorySlug: 'sports',
      slug: 'demo-seed-owner-sports',
      sortOrder: 2,
      priceTiers: [
        [60, 450_000],
        [90, 620_000],
        [120, 790_000],
      ],
      locales: {
        en: { name: 'Sports massage' },
        vi: { name: 'Massage thể thao' },
        ru: { name: 'Спортивный массаж' },
      },
    },
    {
      specialistId: workerSpecialist.id,
      categorySlug: 'relaxing',
      slug: 'demo-seed-worker-relax',
      sortOrder: 0,
      priceTiers: [
        [60, 400_000],
        [90, 550_000],
        [120, 700_000],
      ],
      locales: {
        en: { name: 'Relaxing massage' },
        vi: { name: 'Massage thư giãn' },
        ru: { name: 'Расслабляющий массаж' },
      },
    },
    {
      specialistId: workerSpecialist.id,
      categorySlug: 'feet-reflexology',
      slug: 'demo-seed-worker-foot',
      sortOrder: 1,
      priceTiers: [
        [60, 320_000],
        [90, 450_000],
        [120, 580_000],
      ],
      locales: {
        en: { name: 'Foot reflexology' },
        vi: { name: 'Phản xạ học bàn chân' },
        ru: { name: 'Рефлексология стоп' },
      },
    },
    {
      specialistId: workerSpecialist.id,
      categorySlug: 'neck',
      slug: 'demo-seed-worker-neck',
      sortOrder: 2,
      priceTiers: [
        [30, 280_000],
        [45, 380_000],
        [60, 480_000],
      ],
      locales: {
        en: { name: 'Neck & shoulder massage' },
        vi: { name: 'Massage cổ và vai' },
        ru: { name: 'Массаж шеи и плеч' },
      },
    },
  ];

  for (const row of serviceSeedRows) {
    const cat = bySlug[row.categorySlug];
    if (!cat) {
      throw new Error(
        `[seed-demo-specialists] category slug not found: ${row.categorySlug}`,
      );
    }
    await prisma.service.create({
      data: {
        organizationId: org.id,
        categoryId: cat.id,
        specialistId: row.specialistId,
        name: row.locales.en.name,
        slug: row.slug,
        sortOrder: row.sortOrder,
        isActive: true,
        locales: {
          create: ['en', 'vi', 'ru'].map((locale) => ({
            locale,
            name: row.locales[locale].name,
          })),
        },
        priceOptions: {
          create: row.priceTiers.map(([durationMinutes, priceAmount]) => ({
            durationMinutes,
            priceAmount,
            currency: 'VND',
          })),
        },
      },
    });
  }

  /** Отзывы и агрегаты рейтинга — единым пакетом в конце сида, см. `applyDemoDirectoryReviewPack`. */
  await topUpOriginalSalon(prisma, { passwordHash, bySlug, orgSlug: ORG_SLUG });

  const extraSalonDefs = [
    {
      slug: 'demo-salon-seed-2',
      name: 'Салон «Морской бриз»',
      description: 'Сид: филиал у пляжа, команда из 5 мастеров.',
      city: 'Phú Quốc',
      addressLine: '12 Vo Thi Sau, Duong Dong',
      orgLat: 10.228,
      orgLng: 103.958,
    },
    {
      slug: 'demo-salon-seed-3',
      name: 'Студия «Лотос»',
      description: 'Сид: расслабляющий и тайский массаж.',
      city: 'Phú Quốc',
      addressLine: '88 30/4, Duong Dong',
      orgLat: 10.205,
      orgLng: 103.975,
    },
    {
      slug: 'demo-salon-seed-4',
      name: 'Центр «Ан Минь»',
      description: 'Сид: спорт и реабилитация.',
      city: 'Phú Quốc',
      addressLine: '5 Tran Hung Dao, An Thoi',
      orgLat: 10.125,
      orgLng: 104.018,
    },
    {
      slug: 'demo-salon-seed-5',
      name: 'Спа «Золотой песок»',
      description: 'Сид: SPA и уход.',
      city: 'Phú Quốc',
      addressLine: '200 Nguyen Trung Truc, Duong Dong',
      orgLat: 10.22,
      orgLng: 103.968,
    },
    {
      slug: 'demo-salon-seed-6',
      name: 'Массаж «Bạch Đằng»',
      description: 'Сид: кабинет у набережной, Phú Quốc.',
      city: 'Phú Quốc',
      addressLine: '78 Bach Dang, Duong Dong',
      orgLat: 10.213,
      orgLng: 103.97,
    },
  ];
  for (let i = 0; i < extraSalonDefs.length; i++) {
    await upsertFullSalon(prisma, {
      passwordHash,
      bySlug,
      def: extraSalonDefs[i],
      seedOffset: (i + 1) * 100,
      workday: LISTING_WORKDAY_PRESETS[i + 1],
    });
  }

  await applyDemoDirectoryReviewPack(prisma, [
    clientReviewer,
    clientReviewer2,
    clientReviewer3,
    clientReviewer4,
  ]);

  /** Демо «Мастер 3» (лист / localhost): фиксированный id из витрины; иначе срабатывает флаг у demo.salon.worker2@. */
  await prisma.specialist.updateMany({
    where: { id: '53436e5a-1499-4805-a3d2-95185fdf1a24' },
    data: { autoConfirmBookings: true },
  });

  console.log(
    `[seed] Демо: «${org.slug}» + доводка до ≥5 мастеров; салоны ` +
      `demo-salon-seed-2 … 6. ` +
      `${OWNER_EMAIL} → ${OrganizationMembershipRole.owner}; ` +
      `${WORKER_EMAIL} → ${OrganizationMembershipRole.specialist}. ` +
      `Пароль: ${DEMO_PASSWORD}`,
  );
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} organizationId
 */
async function syncOrganizationRating(prisma, organizationId) {
  const agg = await prisma.organizationReview.aggregate({
    where: { organizationId, deletedAt: null },
    _avg: { rating: true },
    _count: { _all: true },
  });
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      ratingAverage: agg._avg.rating ?? 0,
      reviewsCount: agg._count._all,
    },
  });
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} specialistId
 */
async function syncSpecialistRating(prisma, specialistId) {
  const agg = await prisma.specialistReview.aggregate({
    where: { specialistId, deletedAt: null },
    _avg: { rating: true },
    _count: { _all: true },
  });
  await prisma.specialist.update({
    where: { id: specialistId },
    data: {
      ratingAverage: agg._avg.rating ?? 0,
      reviewsCount: agg._count._all,
    },
  });
}

const DEMO_ORG_REVIEW_COMMENTS = [
  'Clean and calm space, easy to book online.',
  'Warm welcome, the session felt unhurried.',
  'Convenient location, will visit again.',
  'Professional setup from start to finish.',
];

const DEMO_SPEC_REVIEW_COMMENTS = [
  'Skilled and punctual — great work on tension.',
  'Clear communication, I felt very comfortable.',
  'Attentive technique, noticeable relief after one visit.',
  'Calm energy and strong hands, highly recommend.',
  'Thorough and professional—exactly what I needed.',
  'Respectful, on time, and very skilled.',
  'I left relaxed; booking again next week.',
  'Listened to my limits and adapted well.',
];

/**
 * Все демо-организации `demo-salon-seed*`: 2 отзыва на место + по 2 на каждого мастера, затем
 * пересчёт `ratingAverage` / `reviewsCount`. Клиенты — только `authorUsers` (фикс. аккаунты).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ id: string }[]} authorUsers
 */
async function applyDemoDirectoryReviewPack(prisma, authorUsers) {
  if (authorUsers.length === 0) {
    return;
  }
  const orgs = await prisma.organization.findMany({
    where: { slug: { startsWith: 'demo-salon-seed' } },
    select: { id: true },
  });
  const orgIds = orgs.map((o) => o.id);
  if (orgIds.length === 0) {
    return;
  }

  const emps = await prisma.specialistOrganizationEmployment.findMany({
    where: { organizationId: { in: orgIds }, isActive: true },
    select: { specialistId: true },
  });
  const specialistIds = [...new Set(emps.map((e) => e.specialistId))];
  const authorIds = authorUsers.map((u) => u.id);

  await prisma.organizationReview.deleteMany({
    where: { organizationId: { in: orgIds }, authorUserId: { in: authorIds } },
  });
  await prisma.specialistReview.deleteMany({
    where: {
      specialistId: { in: specialistIds },
      authorUserId: { in: authorIds },
    },
  });

  for (let oi = 0; oi < orgs.length; oi++) {
    const org = orgs[oi];
    for (let r = 0; r < 2; r++) {
      const author = authorUsers[(oi + r) % authorUsers.length];
      const rating = 4 + (r % 2);
      const comment =
        DEMO_ORG_REVIEW_COMMENTS[
          (oi * 2 + r) % DEMO_ORG_REVIEW_COMMENTS.length
        ];
      await prisma.organizationReview.create({
        data: {
          organizationId: org.id,
          authorUserId: author.id,
          rating,
          comment,
        },
      });
    }
  }

  for (let si = 0; si < specialistIds.length; si++) {
    const specialistId = specialistIds[si];
    for (let r = 0; r < 2; r++) {
      const author = authorUsers[(si + r) % authorUsers.length];
      const rating = 4 + (r % 2);
      const comment =
        DEMO_SPEC_REVIEW_COMMENTS[
          (si * 2 + r) % DEMO_SPEC_REVIEW_COMMENTS.length
        ];
      await prisma.specialistReview.create({
        data: {
          specialistId,
          authorUserId: author.id,
          rating,
          comment,
        },
      });
    }
  }

  for (const id of orgIds) {
    await syncOrganizationRating(prisma, id);
  }
  for (const id of specialistIds) {
    await syncSpecialistRating(prisma, id);
  }
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} specialistId
 * @param {string} organizationId
 * @param {import('@prisma/client').$Enums.OrganizationMembershipRole} role
 */
async function ensureEmployment(prisma, specialistId, organizationId, role) {
  const row = await prisma.specialistOrganizationEmployment.findFirst({
    where: { specialistId, organizationId },
  });
  if (row) {
    const needsReopen = !row.isActive || row.endDate != null;
    const needsRole = row.role !== role;
    if (needsReopen || needsRole) {
      await prisma.specialistOrganizationEmployment.update({
        where: { id: row.id },
        data: {
          isActive: true,
          endDate: null,
          ...(needsRole ? { role } : {}),
        },
      });
    }
    return;
  }
  await prisma.specialistOrganizationEmployment.create({
    data: {
      specialistId,
      organizationId,
      role,
      startDate: new Date('2020-01-01T00:00:00.000Z'),
      isActive: true,
    },
  });
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} organizationId
 * @param {Record<string, import('@prisma/client').ServiceCategory>} bySlug
 */
async function getOrgCategoryRows(prisma, organizationId, bySlug) {
  const links = await prisma.organizationServiceCategory.findMany({
    where: { organizationId },
    include: { serviceCategory: true },
  });
  if (links.length > 0) {
    return links.map((l) => l.serviceCategory);
  }
  const slugs = ['neck', 'back', 'sports', 'relaxing', 'feet-reflexology'];
  const rows = slugs.map((s) => bySlug[s]).filter(Boolean);
  for (const c of rows) {
    await prisma.organizationServiceCategory.upsert({
      where: {
        organizationId_serviceCategoryId: {
          organizationId,
          serviceCategoryId: c.id,
        },
      },
      create: { organizationId, serviceCategoryId: c.id },
      update: {},
    });
  }
  return rows;
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   passwordHash: string;
 *   bySlug: Record<string, import('@prisma/client').ServiceCategory>;
 *   orgSlug: string;
 * }} ctx
 */
async function topUpOriginalSalon(prisma, ctx) {
  const org = await prisma.organization.findUnique({
    where: { slug: ctx.orgSlug },
  });
  if (!org) {
    console.warn(
      `[seed] Организация «${ctx.orgSlug}» не найдена — пропуск доводки мастеров`,
    );
    return;
  }

  const employments = await prisma.specialistOrganizationEmployment.findMany({
    where: { organizationId: org.id, isActive: true },
    select: { specialistId: true },
  });
  const need = Math.max(0, 5 - employments.length);
  if (need === 0) {
    return;
  }

  const topUpEmails = [
    'demo.salon.worker2@example.com',
    'demo.salon.worker3@example.com',
    'demo.salon.worker4@example.com',
  ].slice(0, need);

  const orgCategoryRows = await getOrgCategoryRows(prisma, org.id, ctx.bySlug);
  let specIndex = employments.length;

  for (const email of topUpEmails) {
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: `Демо мастер ${specIndex + 1}`,
        passwordHash: ctx.passwordHash,
        locale: 'ru',
        phone: `+8490123${String(8000 + specIndex).slice(-4)}`,
        avatarUrl: avatarForSeed(specIndex + 3),
      },
      update: {
        name: `Демо мастер ${specIndex + 1}`,
        passwordHash: ctx.passwordHash,
        avatarUrl: avatarForSeed(specIndex + 3),
      },
    });

    const isDemoAutoConfirm = email === 'demo.salon.worker2@example.com';

    const specialist = await prisma.specialist.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        bio: 'Мастер демо-салона (добавлен сидом).',
        experienceYears: 3 + specIndex,
        imageUrl: avatarForSeed(specIndex + 5).replace('w=128', 'w=200'),
        listingMetaLine: '~ near center | Phu Quoc',
        listingServicesLine: null,
        listedInDirectory: true,
        autoConfirmBookings: isDemoAutoConfirm,
      },
      update: {
        listedInDirectory: true,
        listingMetaLine: 'Dương Đông · Phú Quốc',
        autoConfirmBookings: isDemoAutoConfirm,
      },
    });

    await ensureEmployment(
      prisma,
      specialist.id,
      org.id,
      OrganizationMembershipRole.specialist,
    );

    await prisma.specialist.update({
      where: { id: specialist.id },
      data: { activeOrganizationId: org.id },
    });

    const pick = ['relaxing', 'back', 'neck']
      .map((s) => ctx.bySlug[s])
      .filter(Boolean);
    await prisma.specialistServiceCategory.deleteMany({
      where: { specialistId: specialist.id },
    });
    for (const c of pick) {
      await prisma.specialistServiceCategory.create({
        data: { specialistId: specialist.id, serviceCategoryId: c.id },
      });
    }
    await prisma.specialist.update({
      where: { id: specialist.id },
      data: {
        listingServicesLine: listingServicesLineFromCategories(pick),
      },
    });

    const legacyTopupSlugs = [
      `demo-seed-topup-w${specIndex}-relax`,
      ...pick.map((c) => `demo-seed-topup-w${specIndex}-${c.slug}`),
    ];
    await prisma.service.deleteMany({
      where: {
        organizationId: org.id,
        specialistId: specialist.id,
        slug: { in: legacyTopupSlugs },
      },
    });

    for (let j = 0; j < pick.length; j++) {
      const cat = pick[j];
      if (!cat) {
        continue;
      }
      const slug = `demo-seed-topup-w${specIndex}-${cat.slug}`;
      const catLocales = await prisma.serviceCategoryLocale.findMany({
        where: {
          serviceCategoryId: cat.id,
          locale: { in: ['en', 'vi', 'ru'] },
        },
      });
      const byLoc = Object.fromEntries(
        catLocales.map((l) => [l.locale, l.name]),
      );
      const nameEn = byLoc.en ?? cat.name;
      await prisma.service.create({
        data: {
          organizationId: org.id,
          categoryId: cat.id,
          specialistId: specialist.id,
          name: nameEn,
          slug,
          sortOrder: j,
          isActive: true,
          locales: {
            create: ['en', 'vi', 'ru'].map((locale) => ({
              locale,
              name: byLoc[locale] ?? cat.name,
            })),
          },
          priceOptions: {
            create: [
              [60, 360_000 + j * 15_000],
              [90, 500_000 + j * 20_000],
            ].map(([durationMinutes, priceAmount]) => ({
              durationMinutes,
              priceAmount,
              currency: 'VND',
            })),
          },
        },
      });
    }

    specIndex += 1;
  }

  await prisma.organization.update({
    where: { id: org.id },
    data: {
      listingServicesLine:
        listingServicesLineFromCategories(orgCategoryRows) ??
        org.listingServicesLine,
    },
  });
  await syncOrganizationRating(prisma, org.id);
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   passwordHash: string;
 *   bySlug: Record<string, import('@prisma/client').ServiceCategory>;
 *   def: {
 *     slug: string;
 *     name: string;
 *     description: string;
 *     city: string;
 *     addressLine: string;
 *     orgLat: number;
 *     orgLng: number;
 *   };
 *   seedOffset: number;
 *   workday: { start: number; end: number };
 * }} args
 */
async function upsertFullSalon(prisma, args) {
  const { passwordHash, bySlug, def, seedOffset, workday } = args;
  const ownerEmail = `demo.${def.slug}.owner@example.com`;

  const ownerUser = await prisma.user.upsert({
    where: { email: ownerEmail },
    create: {
      email: ownerEmail,
      name: `Владелец «${def.name}»`,
      passwordHash,
      locale: 'ru',
      phone: `+8490100${String(seedOffset).padStart(4, '0')}`,
      avatarUrl: avatarForSeed(seedOffset),
    },
    update: {
      name: `Владелец «${def.name}»`,
      passwordHash,
      avatarUrl: avatarForSeed(seedOffset),
    },
  });

  const ownerSpecialist = await prisma.specialist.upsert({
    where: { userId: ownerUser.id },
    create: {
      userId: ownerUser.id,
      bio: 'Владелец салона, ведёт приём.',
      experienceYears: 12,
      imageUrl: avatarForSeed(seedOffset + 1).replace('w=128', 'w=200'),
      listingMetaLine: def.city,
      listingServicesLine: null,
      listedInDirectory: false,
    },
    update: {
      listedInDirectory: false,
      listingMetaLine: def.city,
    },
  });

  const org = await prisma.organization.upsert({
    where: { slug: def.slug },
    create: {
      name: def.name,
      slug: def.slug,
      ownerUserId: ownerUser.id,
      description: def.description,
      city: def.city,
      addressLine: def.addressLine,
      phone: `+8428382${String(2000 + seedOffset).slice(-4)}`,
      email: `hello@${def.slug}.example.com`,
      yearsInBusiness: 5,
      latitude: def.orgLat,
      longitude: def.orgLng,
      imageUrl:
        'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=200&h=200&fit=crop',
      listingMetaLine: `~ ${def.city}`,
      listingServicesLine: null,
      listingWorkdayStartMinute: workday.start,
      listingWorkdayEndMinute: workday.end,
    },
    update: {
      name: def.name,
      ownerUserId: ownerUser.id,
      description: def.description,
      city: def.city,
      addressLine: def.addressLine,
      latitude: def.orgLat,
      longitude: def.orgLng,
      listingWorkdayStartMinute: workday.start,
      listingWorkdayEndMinute: workday.end,
    },
  });

  await ensureEmployment(
    prisma,
    ownerSpecialist.id,
    org.id,
    OrganizationMembershipRole.owner,
  );

  const workerSpecs = [];
  for (let w = 1; w <= 4; w++) {
    const email = `demo.${def.slug}.worker${w}@example.com`;
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: `Мастер ${w} · ${def.name}`,
        passwordHash,
        locale: 'vi',
        phone: `+8490200${String(seedOffset + w).padStart(4, '0')}`,
        avatarUrl: avatarForSeed(seedOffset + w + 10),
      },
      update: {
        name: `Мастер ${w} · ${def.name}`,
        passwordHash,
        avatarUrl: avatarForSeed(seedOffset + w + 10),
      },
    });

    const specialist = await prisma.specialist.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        bio: `Мастер салона «${def.name}».`,
        experienceYears: 4 + w,
        imageUrl: avatarForSeed(seedOffset + w + 20).replace('w=128', 'w=200'),
        listingMetaLine: def.city,
        listingServicesLine: null,
        listedInDirectory: true,
      },
      update: {
        listedInDirectory: true,
        listingMetaLine: def.city,
      },
    });
    workerSpecs.push(specialist);

    await ensureEmployment(
      prisma,
      specialist.id,
      org.id,
      OrganizationMembershipRole.specialist,
    );
  }

  const orgCategorySlugs = [
    'neck',
    'back',
    'sports',
    'relaxing',
    'feet-reflexology',
  ];
  await prisma.organizationServiceCategory.deleteMany({
    where: { organizationId: org.id },
  });
  const orgCategoryRows = orgCategorySlugs
    .map((s) => bySlug[s])
    .filter(Boolean);
  for (const c of orgCategoryRows) {
    await prisma.organizationServiceCategory.create({
      data: { organizationId: org.id, serviceCategoryId: c.id },
    });
  }

  await prisma.organization.update({
    where: { id: org.id },
    data: {
      listingServicesLine: listingServicesLineFromCategories(orgCategoryRows),
    },
  });

  const allSpecs = [ownerSpecialist, ...workerSpecs];
  for (const spec of allSpecs) {
    await prisma.specialist.update({
      where: { id: spec.id },
      data: { activeOrganizationId: org.id },
    });
  }

  const categoryRot = ['sports', 'relaxing', 'neck', 'back', 'thai'];

  for (let i = 0; i < allSpecs.length; i++) {
    const spec = allSpecs[i];
    const slugsPick = [
      categoryRot[i % categoryRot.length],
      categoryRot[(i + 1) % categoryRot.length],
    ]
      .map((s) => bySlug[s])
      .filter(Boolean);
    await prisma.specialistServiceCategory.deleteMany({
      where: { specialistId: spec.id },
    });
    for (const c of slugsPick) {
      await prisma.specialistServiceCategory.create({
        data: { specialistId: spec.id, serviceCategoryId: c.id },
      });
    }
    await prisma.specialist.update({
      where: { id: spec.id },
      data: {
        listingServicesLine: listingServicesLineFromCategories(slugsPick),
      },
    });

    /** По одной услуге на каждую подкатегорию в `slugsPick` (как в продукте при выборе категории). */
    const serviceSlugsForSpec = [
      `seed-${def.slug}-spec-${i}-main`,
      ...slugsPick.map((c) => `seed-${def.slug}-spec-${i}-cat-${c.slug}`),
    ];
    await prisma.service.deleteMany({
      where: {
        organizationId: org.id,
        specialistId: spec.id,
        slug: { in: serviceSlugsForSpec },
      },
    });

    for (let j = 0; j < slugsPick.length; j++) {
      const c = slugsPick[j];
      if (!c) {
        continue;
      }
      const svcSlug = `seed-${def.slug}-spec-${i}-cat-${c.slug}`;
      const catLocales = await prisma.serviceCategoryLocale.findMany({
        where: { serviceCategoryId: c.id, locale: { in: ['en', 'vi', 'ru'] } },
      });
      const byLoc = Object.fromEntries(
        catLocales.map((l) => [l.locale, l.name]),
      );
      const nameEn = byLoc.en ?? c.name;
      await prisma.service.create({
        data: {
          organizationId: org.id,
          categoryId: c.id,
          specialistId: spec.id,
          name: nameEn,
          slug: svcSlug,
          sortOrder: j,
          isActive: true,
          locales: {
            create: ['en', 'vi', 'ru'].map((locale) => ({
              locale,
              name: byLoc[locale] ?? c.name,
            })),
          },
          priceOptions: {
            create: [
              [60, 400_000 + i * 10_000 + j * 8_000],
              [90, 540_000 + i * 10_000 + j * 8_000],
              [120, 680_000 + i * 10_000 + j * 8_000],
            ].map(([durationMinutes, priceAmount]) => ({
              durationMinutes,
              priceAmount,
              currency: 'VND',
            })),
          },
        },
      });
    }
  }

  await syncOrganizationRating(prisma, org.id);
}
