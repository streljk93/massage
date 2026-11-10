/**
 * Демо-мастера и организации: базовая пара владелец+сотрудник в `demo-salon-seed`, затем
 * доведение этого салона до ≥5 специалистов и ещё 5 салонов (`demo-salon-seed-2` … `6`):
 * у каждого салона владелец (owner) и всего ≥5 мастеров.
 *
 * Гео (Phú Quốc + карта), категории, отзывы/рейтинги (`applyDemoDirectoryReviewPack`),
 * listedInDirectory (владелец в каталоге мастеров — скрыт, сотрудники — да).
 * Витрина поиска: для каждой точки — опубликованные `OrganizationOffering` + VND-опции
 * и `SpecialistOffering` у мастеров с `listedInDirectory` (клиент шлёт `majorSlug`).
 * Инвариант демо: навыки мастера — строки `SpecialistSkill` (подкатегории без личного прайса;
 * цены гостю — из `OrganizationOffering`).
 * Клиенты-авторы отзывов: нейтральные имена, email `demo.client.*@example.com` (без бренда салона).
 * Идемпотентно: фиксированные email/slug. Пароль (демо): `Demo123456!` — bcrypt 12 раундов.
 */
import bcrypt from 'bcrypt';
import {
  OfferingPriceOptionStatus,
  OfferingPublicationStatus,
  OrganizationMembershipRole,
  PublicationModerationStatus,
  SpecialistOfferingStatus,
} from '@prisma/client';

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

const DEMO_ORG_COVER_IMAGE_URL =
  'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=200&h=200&fit=crop';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} organizationId
 * @param {string} coverImageUrl
 */
async function ensureOrganizationShowcaseGallery(
  prisma,
  organizationId,
  coverImageUrl,
) {
  let g = await prisma.gallery.findUnique({
    where: {
      ownerKind_ownerId: {
        ownerKind: 'organization',
        ownerId: organizationId,
      },
    },
  });
  if (!g) {
    g = await prisma.gallery.create({
      data: {
        ownerKind: 'organization',
        ownerId: organizationId,
      },
    });
  }
  const count = await prisma.galleryItem.count({
    where: { galleryId: g.id },
  });
  if (count === 0) {
    await prisma.galleryItem.create({
      data: {
        galleryId: g.id,
        url: coverImageUrl,
        kind: 'image',
        sortOrder: 0,
      },
    });
  }
}

/** Сила/подстройка (витрина + онбординг); для мастеров в каталоге с местом — дата «завершил настройку». */
const DEMO_SPECIALIST_PRESSURE_LEVEL = 3;
const DEMO_SPECIALIST_PRESSURE_ADAPTS = true;
const DEMO_ONBOARDING_COMPLETED_AT = new Date('2019-06-01T00:00:00.000Z');

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

/** Slug оффера точки в сиде: уникален в пределах организации. */
function seedOrgOfferingSlug(orgSlug, categorySlug) {
  const base = `offer-${orgSlug}-${categorySlug}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '');
  return base.length > 120 ? base.slice(0, 120) : base;
}

/**
 * Опубликованный оффер + активные VND-опции для каждой подкатегории (карточки поиска / бронь).
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} organizationId
 * @param {string} orgSlug
 * @param {Array<{ id: string; slug: string; name: string }>} categories
 */
async function ensurePublishedOrgOfferingsForOrgCategories(
  prisma,
  organizationId,
  orgSlug,
  categories,
) {
  const now = new Date();
  for (const cat of categories) {
    const slug = seedOrgOfferingSlug(orgSlug, cat.slug);
    const title =
      typeof cat.name === 'string' && cat.name.trim() !== ''
        ? cat.name.trim()
        : cat.slug;
    const existing = await prisma.organizationOffering.findFirst({
      where: { organizationId, slug, deletedAt: null },
    });
    if (existing == null) {
      await prisma.organizationOffering.create({
        data: {
          organizationId,
          categoryId: cat.id,
          slug,
          publicationStatus: OfferingPublicationStatus.published,
          firstPublishedAt: now,
          lastPublishedAt: now,
          title,
          priceOptions: {
            create: [
              {
                durationMinutes: 60,
                priceAmount: 400_000,
                currency: 'VND',
                status: OfferingPriceOptionStatus.active,
              },
              {
                durationMinutes: 90,
                priceAmount: 550_000,
                currency: 'VND',
                status: OfferingPriceOptionStatus.active,
              },
            ],
          },
        },
      });
      continue;
    }
    await prisma.organizationOffering.update({
      where: { id: existing.id },
      data: {
        publicationStatus: OfferingPublicationStatus.published,
        deletedAt: null,
        lastPublishedAt: now,
      },
    });
    const activeVndCount = await prisma.offeringPriceOption.count({
      where: {
        organizationOfferingId: existing.id,
        deletedAt: null,
        status: OfferingPriceOptionStatus.active,
        currency: 'VND',
      },
    });
    if (activeVndCount === 0) {
      await prisma.offeringPriceOption.createMany({
        data: [
          {
            organizationOfferingId: existing.id,
            durationMinutes: 60,
            priceAmount: 400_000,
            currency: 'VND',
            status: OfferingPriceOptionStatus.active,
          },
          {
            organizationOfferingId: existing.id,
            durationMinutes: 90,
            priceAmount: 550_000,
            currency: 'VND',
            status: OfferingPriceOptionStatus.active,
          },
        ],
      });
    }
  }
}

/**
 * Пересборка `OrganizationServiceCategory` из опубликованных офферов ∩ сферы организации.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} organizationId
 */
async function syncOrgOscFromPublishedOfferings(prisma, organizationId) {
  const offerings = await prisma.organizationOffering.findMany({
    where: {
      organizationId,
      deletedAt: null,
      publicationStatus: OfferingPublicationStatus.published,
    },
    select: { categoryId: true },
  });
  const orgMajors = await prisma.organizationMajorServiceCategory.findMany({
    where: { organizationId },
    select: { majorServiceCategoryId: true },
  });
  const majorSet = new Set(orgMajors.map((m) => m.majorServiceCategoryId));
  /** @type {Set<string>} */
  const categoryIds = new Set();
  for (const o of offerings) {
    const sc = await prisma.serviceCategory.findFirst({
      where: { id: o.categoryId, deletedAt: null },
      select: { majorServiceCategoryId: true },
    });
    if (
      sc &&
      typeof sc.majorServiceCategoryId === 'string' &&
      majorSet.has(sc.majorServiceCategoryId)
    ) {
      categoryIds.add(o.categoryId);
    }
  }
  await prisma.organizationServiceCategory.deleteMany({
    where: { organizationId },
  });
  for (const serviceCategoryId of categoryIds) {
    await prisma.organizationServiceCategory.create({
      data: { organizationId, serviceCategoryId },
    });
  }
}

/**
 * Активные назначения мастеров из каталога на офферы своей точки по пересечению SSC ∩ офферов точки.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} organizationId
 */
async function ensureSpecialistOfferingAssignmentsForListedAtOrg(
  prisma,
  organizationId,
) {
  const specs = await prisma.specialist.findMany({
    where: {
      deletedAt: null,
      listedInDirectory: true,
      workplaces: {
        some: {
          organizationId,
          isActive: true,
          deletedAt: null,
        },
      },
    },
    select: { id: true },
  });
  const offerings = await prisma.organizationOffering.findMany({
    where: {
      organizationId,
      deletedAt: null,
      publicationStatus: OfferingPublicationStatus.published,
    },
    select: { id: true, categoryId: true },
  });
  /** @type {Map<string, string>} */
  const offeringByCategory = new Map(
    offerings.map((o) => [o.categoryId, o.id]),
  );
  for (const spec of specs) {
    const ssc = await prisma.specialistSkill.findMany({
      where: { specialistId: spec.id },
      select: { serviceCategoryId: true },
    });
    for (const row of ssc) {
      const organizationOfferingId = offeringByCategory.get(
        row.serviceCategoryId,
      );
      if (organizationOfferingId == null) {
        continue;
      }
      await prisma.specialistOffering.upsert({
        where: {
          specialistId_organizationOfferingId: {
            specialistId: spec.id,
            organizationOfferingId,
          },
        },
        create: {
          specialistId: spec.id,
          organizationOfferingId,
          status: SpecialistOfferingStatus.active,
        },
        update: {
          deletedAt: null,
          status: SpecialistOfferingStatus.active,
        },
      });
    }
  }
}

/**
 * Сферы организации ({@link OrganizationMajorServiceCategory}): без этого API бронирования отклоняет оффер
 * (`BOOKING_OFFERING_NOT_FOUND`; проверка совпадения major с точкой в `isOrganizationOfferingBookableMatchingDirectoryVitrineRules`).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} organizationId
 * @param {string} massageMajorId
 */
async function ensureOrganizationMassageMajorScope(
  prisma,
  organizationId,
  massageMajorId,
) {
  await prisma.organizationMajorServiceCategory.upsert({
    where: {
      organizationId_majorServiceCategoryId: {
        organizationId,
        majorServiceCategoryId: massageMajorId,
      },
    },
    create: {
      organizationId,
      majorServiceCategoryId: massageMajorId,
    },
    update: {},
  });
}

async function ensureDemoOrganizationAddress(prisma, organizationId, payload) {
  const o = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { address: true },
  });
  if (!o) {
    return;
  }
  const data = {
    addressLine: payload.addressLine,
    city: payload.city,
    latitude: payload.latitude,
    longitude: payload.longitude,
    sourceProvider: 'seed',
    sourceReference: null,
  };
  if (o.address) {
    await prisma.address.update({
      where: { id: o.address.id },
      data,
    });
  } else {
    const a = await prisma.address.create({ data });
    await prisma.organization.update({
      where: { id: organizationId },
      data: { addressId: a.id },
    });
  }
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
      listingName: 'Демо владелец салона',
      bio: 'Владелец демо-салона, массажист.',
      experienceYears: 10,
      imageUrl:
        'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=200&h=200&fit=crop',
      listedInDirectory: false,
      onboardingCompletedAt: null,
    },
    update: {
      listingName: 'Демо владелец салона',
      bio: 'Владелец демо-салона, массажист.',
      experienceYears: 10,
      imageUrl:
        'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=200&h=200&fit=crop',
      listedInDirectory: false,
      onboardingCompletedAt: null,
    },
  });

  const workerSpecialist = await prisma.specialist.upsert({
    where: { userId: workerUser.id },
    create: {
      userId: workerUser.id,
      listingName: 'Демо мастер (сотрудник)',
      bio: 'Мастер салона (сотрудник).',
      experienceYears: 5,
      imageUrl:
        'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop',
      listedInDirectory: true,
      onboardingCompletedAt: DEMO_ONBOARDING_COMPLETED_AT,
    },
    update: {
      listingName: 'Демо мастер (сотрудник)',
      bio: 'Мастер салона (сотрудник).',
      experienceYears: 5,
      imageUrl:
        'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop',
      listedInDirectory: true,
      onboardingCompletedAt: DEMO_ONBOARDING_COMPLETED_AT,
    },
  });

  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    create: {
      name: 'Демо-салон «Массаж»',
      slug: ORG_SLUG,
      ownerUserId: ownerUser.id,
      description: 'Сид для разработки: владелец и сотрудник.',
      phone: '+842838220001',
      email: 'hello@demo-salon-seed.example.com',
      yearsInBusiness: 8,
      listingWorkdayStartMinute: LISTING_WORKDAY_PRESETS[0].start,
      listingWorkdayEndMinute: LISTING_WORKDAY_PRESETS[0].end,
    },
    update: {
      name: 'Демо-салон «Массаж»',
      ownerUserId: ownerUser.id,
      description: 'Сид для разработки: владелец и сотрудник.',
      phone: '+842838220001',
      email: 'hello@demo-salon-seed.example.com',
      yearsInBusiness: 8,
      listingWorkdayStartMinute: LISTING_WORKDAY_PRESETS[0].start,
      listingWorkdayEndMinute: LISTING_WORKDAY_PRESETS[0].end,
    },
  });
  await ensureDemoOrganizationAddress(prisma, org.id, {
    addressLine: '118 Tran Hung Dao, Duong Dong',
    city: 'Phú Quốc',
    latitude: ORG_LAT,
    longitude: ORG_LNG,
  });
  await ensureOrganizationShowcaseGallery(
    prisma,
    org.id,
    DEMO_ORG_COVER_IMAGE_URL,
  );

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
  await ensureSpecialistActiveWorkplace(prisma, ownerSpecialist.id, org.id);
  await prisma.specialist.update({
    where: { id: workerSpecialist.id },
    data: { activeOrganizationId: org.id },
  });
  await ensureSpecialistActiveWorkplace(prisma, workerSpecialist.id, org.id);

  const massageMajor = await prisma.majorServiceCategory.findUnique({
    where: { slug: 'massage' },
  });
  if (!massageMajor) {
    throw new Error('[seed-demo-specialists] major category massage not found');
  }

  await ensureOrganizationMassageMajorScope(prisma, org.id, massageMajor.id);

  const categorySlugs = [
    'neck-shoulder-back-therapy',
    'deep-tissue-massage',
    'thai-massage',
    'herbal-massage',
    'foot-massage',
    'aroma-massage',
    'hot-stone-massage',
    'hair-wash',
  ];
  const categories = await prisma.serviceCategory.findMany({
    where: {
      majorServiceCategoryId: massageMajor.id,
      slug: { in: categorySlugs },
    },
  });

  const bySlug = Object.fromEntries(categories.map((x) => [x.slug, x]));
  /** Все выбранные для витрины подкатегории (порядок как в `categorySlugs`). */
  const orgCategoryRows = categorySlugs.map((s) => bySlug[s]).filter(Boolean);
  await ensurePublishedOrgOfferingsForOrgCategories(
    prisma,
    org.id,
    org.slug,
    orgCategoryRows,
  );
  await syncOrgOscFromPublishedOfferings(prisma, org.id);

  await prisma.specialistSkill.deleteMany({
    where: {
      specialistId: { in: [ownerSpecialist.id, workerSpecialist.id] },
    },
  });
  const ownerPick = ['neck-shoulder-back-therapy', 'deep-tissue-massage', 'thai-massage']
    .map((s) => bySlug[s])
    .filter(Boolean);
  const workerPick = ['herbal-massage', 'foot-massage', 'neck-shoulder-back-therapy']
    .map((s) => bySlug[s])
    .filter(Boolean);
  for (const c of ownerPick) {
    await prisma.specialistSkill.create({
      data: {
        specialistId: ownerSpecialist.id,
        serviceCategoryId: c.id,
      },
    });
  }
  for (const c of workerPick) {
    await prisma.specialistSkill.create({
      data: {
        specialistId: workerSpecialist.id,
        serviceCategoryId: c.id,
      },
    });
  }

  await ensureSpecialistOfferingAssignmentsForListedAtOrg(prisma, org.id);

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

  const demoSpecialistIds = await prisma.specialist.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });
  for (const { id } of demoSpecialistIds) {
    await prisma.specialistMassageProfile.upsert({
      where: { specialistId: id },
      create: {
        specialistId: id,
        pressureLevel: DEMO_SPECIALIST_PRESSURE_LEVEL,
        pressureAdaptsToClient: DEMO_SPECIALIST_PRESSURE_ADAPTS,
      },
      update: {
        pressureLevel: DEMO_SPECIALIST_PRESSURE_LEVEL,
        pressureAdaptsToClient: DEMO_SPECIALIST_PRESSURE_ADAPTS,
      },
    });
  }
  await prisma.specialist.updateMany({
    where: {
      listedInDirectory: true,
      workplaces: { some: { isActive: true, deletedAt: null } },
      onboardingCompletedAt: null,
      deletedAt: null,
    },
    data: { onboardingCompletedAt: DEMO_ONBOARDING_COMPLETED_AT },
  });

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
          publishedComment: comment,
          pendingCommentDraft: null,
          publicationModerationStatus: PublicationModerationStatus.approved,
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
          publishedComment: comment,
          pendingCommentDraft: null,
          publicationModerationStatus: PublicationModerationStatus.approved,
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
 * @param {string} specialistId
 * @param {string} organizationId
 */
async function ensureSpecialistActiveWorkplace(
  prisma,
  specialistId,
  organizationId,
) {
  await prisma.specialistProfile.upsert({
    where: { specialistId },
    create: { specialistId, isActive: true },
    update: { isActive: true },
  });
  await prisma.specialistWorkplace.updateMany({
    where: {
      specialistId,
      isActive: true,
      deletedAt: null,
      NOT: { organizationId },
    },
    data: { isActive: false },
  });
  await prisma.specialistWorkplace.upsert({
    where: {
      specialistId_organizationId: {
        specialistId,
        organizationId,
      },
    },
    create: {
      specialistId,
      organizationId,
      isActive: true,
    },
    update: {
      isActive: true,
      deletedAt: null,
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
  const slugs = [
    'neck-shoulder-back-therapy',
    'deep-tissue-massage',
    'thai-massage',
    'herbal-massage',
    'foot-massage',
  ];
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

  const massageMajor = await prisma.majorServiceCategory.findUnique({
    where: { slug: 'massage' },
  });
  if (massageMajor) {
    await ensureOrganizationMassageMajorScope(prisma, org.id, massageMajor.id);
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

  const seedCats = await getOrgCategoryRows(prisma, org.id, ctx.bySlug);
  await ensurePublishedOrgOfferingsForOrgCategories(
    prisma,
    org.id,
    org.slug,
    seedCats,
  );
  await syncOrgOscFromPublishedOfferings(prisma, org.id);

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
        listedInDirectory: true,
        autoConfirmBookings: isDemoAutoConfirm,
        onboardingCompletedAt: DEMO_ONBOARDING_COMPLETED_AT,
      },
      update: {
        listedInDirectory: true,
        autoConfirmBookings: isDemoAutoConfirm,
        onboardingCompletedAt: DEMO_ONBOARDING_COMPLETED_AT,
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
    await ensureSpecialistActiveWorkplace(prisma, specialist.id, org.id);

    const pick = ['herbal-massage', 'deep-tissue-massage', 'neck-shoulder-back-therapy']
      .map((s) => ctx.bySlug[s])
      .filter(Boolean);
    await prisma.specialistSkill.deleteMany({
      where: { specialistId: specialist.id },
    });
    for (const c of pick) {
      await prisma.specialistSkill.create({
        data: { specialistId: specialist.id, serviceCategoryId: c.id },
      });
    }

    specIndex += 1;
  }

  await ensureSpecialistOfferingAssignmentsForListedAtOrg(prisma, org.id);

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
  const massageMajor = await prisma.majorServiceCategory.findUnique({
    where: { slug: 'massage' },
  });
  if (!massageMajor) {
    throw new Error(
      '[seed-demo-specialists] major category massage not found (upsertFullSalon)',
    );
  }
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
      listingName: `Владелец «${def.name}»`,
      bio: 'Владелец салона, ведёт приём.',
      experienceYears: 12,
      imageUrl: avatarForSeed(seedOffset + 1).replace('w=128', 'w=200'),
      listedInDirectory: false,
      onboardingCompletedAt: null,
    },
    update: {
      listingName: `Владелец «${def.name}»`,
      listedInDirectory: false,
      onboardingCompletedAt: null,
    },
  });

  const org = await prisma.organization.upsert({
    where: { slug: def.slug },
    create: {
      name: def.name,
      slug: def.slug,
      ownerUserId: ownerUser.id,
      description: def.description,
      phone: `+8428382${String(2000 + seedOffset).slice(-4)}`,
      email: `hello@${def.slug}.example.com`,
      yearsInBusiness: 5,
      listingWorkdayStartMinute: workday.start,
      listingWorkdayEndMinute: workday.end,
    },
    update: {
      name: def.name,
      ownerUserId: ownerUser.id,
      description: def.description,
      listingWorkdayStartMinute: workday.start,
      listingWorkdayEndMinute: workday.end,
    },
  });
  await ensureDemoOrganizationAddress(prisma, org.id, {
    addressLine: def.addressLine,
    city: def.city,
    latitude: def.orgLat,
    longitude: def.orgLng,
  });
  await ensureOrganizationShowcaseGallery(
    prisma,
    org.id,
    DEMO_ORG_COVER_IMAGE_URL,
  );

  await ensureOrganizationMassageMajorScope(prisma, org.id, massageMajor.id);

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
        listingName: `Мастер ${w} · ${def.name}`,
        bio: `Мастер салона «${def.name}».`,
        experienceYears: 4 + w,
        imageUrl: avatarForSeed(seedOffset + w + 20).replace('w=128', 'w=200'),
        listedInDirectory: true,
        onboardingCompletedAt: DEMO_ONBOARDING_COMPLETED_AT,
      },
      update: {
        listingName: `Мастер ${w} · ${def.name}`,
        listedInDirectory: true,
        onboardingCompletedAt: DEMO_ONBOARDING_COMPLETED_AT,
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
    'neck-shoulder-back-therapy',
    'deep-tissue-massage',
    'thai-massage',
    'herbal-massage',
    'foot-massage',
  ];
  const orgCategoryRows = orgCategorySlugs
    .map((s) => bySlug[s])
    .filter(Boolean);
  await ensurePublishedOrgOfferingsForOrgCategories(
    prisma,
    org.id,
    def.slug,
    orgCategoryRows,
  );
  await syncOrgOscFromPublishedOfferings(prisma, org.id);

  const allSpecs = [ownerSpecialist, ...workerSpecs];
  for (const spec of allSpecs) {
    await prisma.specialist.update({
      where: { id: spec.id },
      data: { activeOrganizationId: org.id },
    });
    await ensureSpecialistActiveWorkplace(prisma, spec.id, org.id);
  }

  const categoryRot = [
    'thai-massage',
    'herbal-massage',
    'neck-shoulder-back-therapy',
    'deep-tissue-massage',
    'foot-massage',
  ];

  for (let i = 0; i < allSpecs.length; i++) {
    const spec = allSpecs[i];
    const slugsPick = [
      categoryRot[i % categoryRot.length],
      categoryRot[(i + 1) % categoryRot.length],
    ]
      .map((s) => bySlug[s])
      .filter(Boolean);
    await prisma.specialistSkill.deleteMany({
      where: { specialistId: spec.id },
    });
    for (const c of slugsPick) {
      await prisma.specialistSkill.create({
        data: { specialistId: spec.id, serviceCategoryId: c.id },
      });
    }
  }

  await ensureSpecialistOfferingAssignmentsForListedAtOrg(prisma, org.id);

  await syncOrganizationRating(prisma, org.id);
}

function isDemoSeedUserEmail(email) {
  const e = (email ?? '').trim().toLowerCase();
  if (e.length === 0) {
    return false;
  }
  if (e === 'hello@demo-salon-seed.example.com') {
    return true;
  }
  return e.endsWith('@example.com') && e.startsWith('demo.');
}

/**
 * Удаляет салоны `demo-salon-seed*` и учётки demo.*@example.com из сида.
 * Реальные организации и пользователи не трогает.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 */
export async function purgeDemoSeedData(prisma) {
  const demoOrgs = await prisma.organization.findMany({
    where: { slug: { startsWith: 'demo-salon-seed' } },
    select: { id: true, slug: true },
  });
  for (const org of demoOrgs) {
    await prisma.organization.delete({ where: { id: org.id } });
    console.log(`[purge-demo] Удалена организация ${org.slug}`);
  }

  const users = await prisma.user.findMany({
    where: { email: { not: null } },
    select: { id: true, email: true },
  });
  const demoUsers = users.filter((u) => isDemoSeedUserEmail(u.email));
  for (const u of demoUsers) {
    try {
      await prisma.user.delete({ where: { id: u.id } });
      console.log(`[purge-demo] Удалён пользователь ${u.email}`);
    } catch (err) {
      console.warn(
        `[purge-demo] Не удалось удалить ${u.email}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  const leftovers = await prisma.organization.count({
    where: { slug: { startsWith: 'demo-salon-seed' } },
  });
  if (leftovers > 0) {
    console.warn(`[purge-demo] Осталось demo-организаций: ${leftovers}`);
  } else {
    console.log('[purge-demo] Готово: демо-салоны и demo-учётки сняты.');
  }
}
