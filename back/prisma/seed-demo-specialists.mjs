/**
 * Два демо-специалиста и один салон (организация):
 * — владелец: User.ownerOrganizations + Specialist + активное employment;
 * — сотрудник: тот же салон через employment, роль specialist (не владелец по ownerUserId).
 *
 * Дополнительно: гео (Organization + Specialist; у User в схеме нет lat/lng — только phone/avatar),
 * выбранные категории (M2M), отзывы и денормализованный рейтинг,
 * listedInDirectory: владелец скрыт из каталога мастеров, сотрудник — в каталоге.
 *
 * Идемпотентно: фиксированные email и slug организации.
 * Пароль для владельца/сотрудника (демо): `Demo123456!` — bcrypt 12 раундов как в PasswordHasher.
 */
import bcrypt from "bcrypt";
import { OrganizationMembershipRole } from "@prisma/client";

const SALT_ROUNDS = 12;

const DEMO_PASSWORD = "Demo123456!";

const OWNER_EMAIL = "demo.salon.owner@example.com";
const WORKER_EMAIL = "demo.salon.worker@example.com";
const CLIENT_REVIEW_EMAIL = "demo.client.reviews@example.com";
const CLIENT_REVIEW_EMAIL_2 = "demo.client.reviews2@example.com";
const ORG_SLUG = "demo-salon-seed";

/** Phú Quốc, Dương Đông — демо на острове (карта / адрес). */
const ORG_LAT = 10.216_5;
const ORG_LNG = 103.963_5;
/** Рядом с салоном. */
const OWNER_SPEC_LAT = 10.215_2;
const OWNER_SPEC_LNG = 103.962_8;
/** Вторая точка в Dương Đông. */
const WORKER_SPEC_LAT = 10.223_1;
const WORKER_SPEC_LNG = 103.971_4;

/**
 * Вторая строка карточки из выбранных подкатегорий (канонический shortName в БД = en).
 * @param {{ shortName: string }[]} cats
 */
function listingServicesLineFromCategories(cats) {
  if (!cats.length) return null;
  return cats.map((c) => c.shortName).join(" · ");
}

/** Fallback JSON для карточек, если в БД нет слотов в окне «сегодня/завтра». */
const LISTING_SLOTS_ORG = [
  { dayKey: "today", times: ["09:00", "10:00", "11:30"] },
  { dayKey: "tomorrow", times: ["09:00", "12:00", "15:00"] },
];
const LISTING_SLOTS_OWNER = [
  { dayKey: "today", times: ["09:00", "10:00"] },
  { dayKey: "tomorrow", times: ["11:00", "16:00"] },
];
const LISTING_SLOTS_WORKER = [
  { dayKey: "today", times: ["11:00", "15:00"] },
  { dayKey: "tomorrow", times: ["09:30", "13:00", "17:00"] },
];

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 */
export async function seedDemoSpecialists(prisma) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

  const ownerUser = await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    create: {
      email: OWNER_EMAIL,
      name: "Демо владелец салона",
      passwordHash,
      locale: "ru",
      phone: "+84901234567",
      avatarUrl:
        "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=128&h=128&fit=crop",
    },
    update: {
      name: "Демо владелец салона",
      passwordHash,
      phone: "+84901234567",
      avatarUrl:
        "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=128&h=128&fit=crop",
    },
  });

  const workerUser = await prisma.user.upsert({
    where: { email: WORKER_EMAIL },
    create: {
      email: WORKER_EMAIL,
      name: "Демо мастер (сотрудник)",
      passwordHash,
      locale: "ru",
      phone: "+84907654321",
      avatarUrl:
        "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=128&h=128&fit=crop",
    },
    update: {
      name: "Демо мастер (сотрудник)",
      passwordHash,
      phone: "+84907654321",
      avatarUrl:
        "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=128&h=128&fit=crop",
    },
  });

  const clientReviewer = await prisma.user.upsert({
    where: { email: CLIENT_REVIEW_EMAIL },
    create: {
      email: CLIENT_REVIEW_EMAIL,
      name: "Demo Guest",
      passwordHash: null,
      locale: "en",
      phone: "+84901112233",
      avatarUrl:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop",
    },
    update: {
      name: "Demo Guest",
      phone: "+84901112233",
      avatarUrl:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop",
    },
  });

  const clientReviewer2 = await prisma.user.upsert({
    where: { email: CLIENT_REVIEW_EMAIL_2 },
    create: {
      email: CLIENT_REVIEW_EMAIL_2,
      name: "Demo Visitor",
      passwordHash: null,
      locale: "vi",
      phone: "+84904445566",
      avatarUrl:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128&h=128&fit=crop",
    },
    update: {
      name: "Demo Visitor",
      phone: "+84904445566",
      avatarUrl:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128&h=128&fit=crop",
    },
  });

  const ownerSpecialist = await prisma.specialist.upsert({
    where: { userId: ownerUser.id },
    create: {
      userId: ownerUser.id,
      bio: "Владелец демо-салона, массажист.",
      experienceYears: 10,
      latitude: OWNER_SPEC_LAT,
      longitude: OWNER_SPEC_LNG,
      addressLine: "118 Tran Hung Dao, Duong Dong",
      city: "Phú Quốc",
      imageUrl:
        "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=200&h=200&fit=crop",
      listingMetaLine: "~ 500m from night market | Duong Dong, Phu Quoc",
      listingServicesLine: null,
      listingSlotGroups: LISTING_SLOTS_OWNER,
      listedInDirectory: false,
    },
    update: {
      bio: "Владелец демо-салона, массажист.",
      experienceYears: 10,
      latitude: OWNER_SPEC_LAT,
      longitude: OWNER_SPEC_LNG,
      addressLine: "118 Tran Hung Dao, Duong Dong",
      city: "Phú Quốc",
      imageUrl:
        "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=200&h=200&fit=crop",
      listingMetaLine: "~ 500m from night market | Duong Dong, Phu Quoc",
      listingServicesLine: null,
      listingSlotGroups: LISTING_SLOTS_OWNER,
      listedInDirectory: false,
    },
  });

  const workerSpecialist = await prisma.specialist.upsert({
    where: { userId: workerUser.id },
    create: {
      userId: workerUser.id,
      bio: "Мастер салона (сотрудник).",
      experienceYears: 5,
      latitude: WORKER_SPEC_LAT,
      longitude: WORKER_SPEC_LNG,
      addressLine: "45 Le Loi, Duong Dong",
      city: "Phú Quốc",
      imageUrl:
        "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop",
      listingMetaLine: "~ 1km from center | Duong Dong, Phu Quoc",
      listingServicesLine: null,
      listingSlotGroups: LISTING_SLOTS_WORKER,
      listedInDirectory: true,
    },
    update: {
      bio: "Мастер салона (сотрудник).",
      experienceYears: 5,
      latitude: WORKER_SPEC_LAT,
      longitude: WORKER_SPEC_LNG,
      addressLine: "45 Le Loi, Duong Dong",
      city: "Phú Quốc",
      imageUrl:
        "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop",
      listingMetaLine: "~ 1km from center | Duong Dong, Phu Quoc",
      listingServicesLine: null,
      listingSlotGroups: LISTING_SLOTS_WORKER,
      listedInDirectory: true,
    },
  });

  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    create: {
      name: "Демо-салон «Массаж»",
      slug: ORG_SLUG,
      ownerUserId: ownerUser.id,
      description: "Сид для разработки: владелец и сотрудник.",
      city: "Phú Quốc",
      addressLine: "118 Tran Hung Dao, Duong Dong",
      phone: "+842838220001",
      email: "hello@demo-salon-seed.example.com",
      yearsInBusiness: 8,
      latitude: ORG_LAT,
      longitude: ORG_LNG,
      imageUrl:
        "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=200&h=200&fit=crop",
      listingMetaLine: "~ 500m from night market | Duong Dong, Phu Quoc",
      listingServicesLine: null,
      listingSlotGroups: LISTING_SLOTS_ORG,
    },
    update: {
      name: "Демо-салон «Массаж»",
      ownerUserId: ownerUser.id,
      description: "Сид для разработки: владелец и сотрудник.",
      city: "Phú Quốc",
      addressLine: "118 Tran Hung Dao, Duong Dong",
      phone: "+842838220001",
      email: "hello@demo-salon-seed.example.com",
      yearsInBusiness: 8,
      latitude: ORG_LAT,
      longitude: ORG_LNG,
      imageUrl:
        "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=200&h=200&fit=crop",
      listingMetaLine: "~ 500m from night market | Duong Dong, Phu Quoc",
      listingServicesLine: null,
      listingSlotGroups: LISTING_SLOTS_ORG,
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

  const massageMajor = await prisma.majorServiceCategory.findUnique({
    where: { slug: "massage" },
  });
  if (!massageMajor) {
    throw new Error("[seed-demo-specialists] major category massage not found");
  }

  const categorySlugs = [
    "neck",
    "back",
    "sports",
    "relaxing",
    "feet-reflexology",
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
  const orgCategoryRows = categorySlugs
    .map((s) => bySlug[s])
    .filter(Boolean);
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
  const ownerPick = ["neck", "back", "sports"]
    .map((s) => bySlug[s])
    .filter(Boolean);
  const workerPick = ["relaxing", "feet-reflexology", "neck"]
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
          "demo-seed-owner-sports",
          "demo-seed-worker-relax",
          "demo-seed-worker-foot",
          "demo-seed-worker-neck",
        ],
      },
    },
  });

  const serviceSeedRows = [
    {
      specialistId: ownerSpecialist.id,
      categorySlug: "sports",
      slug: "demo-seed-owner-sports",
      sortOrder: 0,
      priceTiers: [
        [60, 450_000],
        [90, 620_000],
        [120, 790_000],
      ],
      locales: {
        en: { name: "Sports massage" },
        vi: { name: "Massage thể thao" },
        ru: { name: "Спортивный массаж" },
      },
    },
    {
      specialistId: workerSpecialist.id,
      categorySlug: "relaxing",
      slug: "demo-seed-worker-relax",
      sortOrder: 0,
      priceTiers: [
        [60, 400_000],
        [90, 550_000],
        [120, 700_000],
      ],
      locales: {
        en: { name: "Relaxing massage" },
        vi: { name: "Massage thư giãn" },
        ru: { name: "Расслабляющий массаж" },
      },
    },
    {
      specialistId: workerSpecialist.id,
      categorySlug: "feet-reflexology",
      slug: "demo-seed-worker-foot",
      sortOrder: 1,
      priceTiers: [
        [60, 320_000],
        [90, 450_000],
        [120, 580_000],
      ],
      locales: {
        en: { name: "Foot reflexology" },
        vi: { name: "Phản xạ học bàn chân" },
        ru: { name: "Рефлексология стоп" },
      },
    },
    {
      specialistId: workerSpecialist.id,
      categorySlug: "neck",
      slug: "demo-seed-worker-neck",
      sortOrder: 2,
      priceTiers: [
        [30, 280_000],
        [45, 380_000],
        [60, 480_000],
      ],
      locales: {
        en: { name: "Neck & shoulder massage" },
        vi: { name: "Massage cổ và vai" },
        ru: { name: "Массаж шеи и плеч" },
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
          create: ["en", "vi", "ru"].map((locale) => ({
            locale,
            name: row.locales[locale].name,
          })),
        },
        priceOptions: {
          create: row.priceTiers.map(([durationMinutes, priceAmount]) => ({
            durationMinutes,
            priceAmount,
            currency: "VND",
          })),
        },
      },
    });
  }

  const seedReviewAuthorIds = [clientReviewer.id, clientReviewer2.id];
  await prisma.organizationReview.deleteMany({
    where: {
      organizationId: org.id,
      authorUserId: { in: seedReviewAuthorIds },
    },
  });
  await prisma.specialistReview.deleteMany({
    where: {
      specialistId: { in: [ownerSpecialist.id, workerSpecialist.id] },
      authorUserId: { in: seedReviewAuthorIds },
    },
  });

  await prisma.organizationReview.createMany({
    data: [
      {
        organizationId: org.id,
        authorUserId: clientReviewer.id,
        rating: 5,
        comment: "Great demo salon, clean and professional.",
      },
      {
        organizationId: org.id,
        authorUserId: clientReviewer.id,
        rating: 4,
        comment: "Nice atmosphere.",
      },
      {
        organizationId: org.id,
        authorUserId: clientReviewer2.id,
        rating: 5,
        comment: "Staff is friendly, easy booking.",
      },
      {
        organizationId: org.id,
        authorUserId: clientReviewer2.id,
        rating: 4,
        comment: "Good value on Phu Quoc.",
      },
    ],
  });

  await prisma.specialistReview.createMany({
    data: [
      {
        specialistId: ownerSpecialist.id,
        authorUserId: clientReviewer.id,
        rating: 5,
        comment: "Excellent therapist.",
      },
      {
        specialistId: ownerSpecialist.id,
        authorUserId: clientReviewer2.id,
        rating: 4,
        comment: "Strong hands, will return.",
      },
      {
        specialistId: workerSpecialist.id,
        authorUserId: clientReviewer.id,
        rating: 5,
        comment: "Very relaxing session.",
      },
      {
        specialistId: workerSpecialist.id,
        authorUserId: clientReviewer2.id,
        rating: 5,
        comment: "Calm energy, great foot work.",
      },
    ],
  });

  await syncOrganizationRating(prisma, org.id);
  await syncSpecialistRating(prisma, ownerSpecialist.id);
  await syncSpecialistRating(prisma, workerSpecialist.id);

  console.log(
    `[seed] Демо-специалисты: «${org.slug}» (${org.id}); ` +
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
      startDate: new Date("2020-01-01T00:00:00.000Z"),
      isActive: true,
    },
  });
}
