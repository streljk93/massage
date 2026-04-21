export const homeUser = {
  firstName: "Evgenii",
  avatarSrc: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=128&h=128&fit=crop",
};

export const currentBooking = {
  specialistName: "Nha Trang",
  /** Демо: с API придут `nameKey` / готовая строка + числовые поля для Intl. */
  service: {
    nameKey: "booking.demoFootMassage" as const,
    amount: 500_000,
    currency: "VND" as const,
  },
  timeRange: "14:00 – 15:30",
  avatarSrc:
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=128&h=128&fit=crop",
};

/** Сырые группы для карточек: ключ дня переводится на экране через `slots.*`. */
export type SlotGroupSeed = {
  dayKey: "today" | "tomorrow";
  times: string[];
};

/** Координаты для карты (остров Phú Quốc), демо-данные. */
export const topSalons = [
  {
    id: "s1",
    name: "Nguyễn Ngọc",
    lat: 10.2152,
    lng: 103.9628,
    imageSrc: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=200&h=200&fit=crop",
    rating: 4.5,
    metaLine: "~ 1km from you | 123 Nguyen Trai str.",
    servicesLine: "Foots, hands, back, neck…",
    slotGroups: [
      { dayKey: "today" as const, times: ["09:00", "10:00", "11:30"] },
      { dayKey: "tomorrow" as const, times: ["09:00", "12:00", "15:00"] },
    ] satisfies SlotGroupSeed[],
  },
  {
    id: "s2",
    name: "Sen Spa",
    lat: 10.2231,
    lng: 103.9714,
    imageSrc: "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=200&h=200&fit=crop",
    rating: 4.8,
    metaLine: "~ 2km from you | Tran Hung Dao",
    servicesLine: "Aroma, hot stone, foot…",
    slotGroups: [
      { dayKey: "today" as const, times: ["10:00", "12:00"] },
      { dayKey: "tomorrow" as const, times: ["08:30", "14:00"] },
    ] satisfies SlotGroupSeed[],
  },
];

export const topSpecialists = [
  {
    id: "p1",
    name: "Nguyễn Ngọc",
    lat: 10.2178,
    lng: 103.9655,
    imageSrc: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=200&h=200&fit=crop",
    rating: 4.5,
    metaLine: "~ 1km from you | 123 Nguyen Trai str.",
    servicesLine: "Foots, hands, back, neck…",
    slotGroups: [
      { dayKey: "today" as const, times: ["09:00", "10:00"] },
      { dayKey: "tomorrow" as const, times: ["11:00", "16:00"] },
    ] satisfies SlotGroupSeed[],
  },
  {
    id: "p2",
    name: "Lan Anh",
    lat: 10.2294,
    lng: 103.9742,
    imageSrc: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop",
    rating: 4.9,
    metaLine: "~ 3km from you | Duong Dong",
    servicesLine: "Thai, Swedish, reflexology…",
    slotGroups: [
      { dayKey: "today" as const, times: ["11:00", "15:00"] },
      { dayKey: "tomorrow" as const, times: ["09:30", "13:00", "17:00"] },
    ] satisfies SlotGroupSeed[],
  },
  {
    id: "p3",
    name: "Minh Tuấn",
    lat: 10.2201,
    lng: 103.9688,
    imageSrc: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop",
    rating: 4.7,
    metaLine: "~ 1.5km from you | Tran Hung Dao",
    servicesLine: "Deep tissue, sports massage, stretching…",
    slotGroups: [
      { dayKey: "today" as const, times: ["08:00", "14:00"] },
      { dayKey: "tomorrow" as const, times: ["10:00", "16:00"] },
    ] satisfies SlotGroupSeed[],
  },
  {
    id: "p4",
    name: "Thảo My",
    lat: 10.232,
    lng: 103.9695,
    imageSrc: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop",
    rating: 4.8,
    metaLine: "~ 2km from you | Cua Duong",
    servicesLine: "Aroma oil, hot stone, head & neck…",
    slotGroups: [
      { dayKey: "today" as const, times: ["09:00", "13:30"] },
      { dayKey: "tomorrow" as const, times: ["11:00", "15:30"] },
    ] satisfies SlotGroupSeed[],
  },
  {
    id: "p5",
    name: "Hải Long",
    lat: 10.2185,
    lng: 103.977,
    imageSrc: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop",
    rating: 4.6,
    metaLine: "~ 4km from you | An Thoi",
    servicesLine: "Foot reflexology, cupping, relax combo…",
    slotGroups: [
      { dayKey: "today" as const, times: ["10:30", "17:00"] },
      { dayKey: "tomorrow" as const, times: ["08:30", "12:30"] },
    ] satisfies SlotGroupSeed[],
  },
  {
    id: "p6",
    name: "Quỳnh Anh",
    lat: 10.2245,
    lng: 103.9635,
    imageSrc: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop",
    rating: 4.7,
    metaLine: "~ 1km from you | Dinh Cậu",
    servicesLine: "Lymphatic, facial massage, gentle relax…",
    slotGroups: [
      { dayKey: "today" as const, times: ["09:30", "14:30"] },
      { dayKey: "tomorrow" as const, times: ["10:00", "16:00"] },
    ] satisfies SlotGroupSeed[],
  },
];

export const promoSlides = [
  {
    id: "promo-1",
    titleKey: "promo.promo1.title" as const,
    subtitleKey: "promo.promo1.subtitle" as const,
    ctaKey: "promo.promo1.cta" as const,
    imageSrc:
      "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=400&h=300&fit=crop",
  },
  {
    id: "promo-2",
    titleKey: "promo.promo2.title" as const,
    subtitleKey: "promo.promo2.subtitle" as const,
    ctaKey: "promo.promo2.cta" as const,
    imageSrc:
      "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=300&fit=crop",
  },
];
