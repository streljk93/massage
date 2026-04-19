export const homeUser = {
  firstName: "Evgenii",
  locationLabel: "Phu Quoc",
  avatarSrc: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=128&h=128&fit=crop",
};

export const categories = [
  { id: "neck", labelKey: "categories.neck" as const, emoji: "🧘" },
  { id: "body", labelKey: "categories.body" as const, emoji: "✋" },
  { id: "foot", labelKey: "categories.foot" as const, emoji: "🦶" },
  { id: "spa", labelKey: "categories.spa" as const, emoji: "💆" },
  { id: "combo", labelKey: "categories.combo" as const, emoji: "⭐" },
];

export const currentBooking = {
  specialistName: "Nha Trang",
  serviceLine: "Massage foot 500 000 VND",
  timeRange: "14:00 – 15:30",
  avatarSrc:
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=128&h=128&fit=crop",
};

export const topSalons = [
  {
    id: "s1",
    name: "Nguyễn Ngọc",
    imageSrc: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=200&h=200&fit=crop",
    rating: 4.5,
    metaLine: "~ 1km from you | 123 Nguyen Trai str.",
    servicesLine: "Foots, hands, back, neck…",
    slotLabels: ["today", "09:00", "10:00", "11:30"],
  },
  {
    id: "s2",
    name: "Sen Spa",
    imageSrc: "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=200&h=200&fit=crop",
    rating: 4.8,
    metaLine: "~ 2km from you | Tran Hung Dao",
    servicesLine: "Aroma, hot stone, foot…",
    slotLabels: ["today", "10:00", "12:00"],
  },
];

export const topSpecialists = [
  {
    id: "p1",
    name: "Nguyễn Ngọc",
    imageSrc: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=200&h=200&fit=crop",
    rating: 4.5,
    metaLine: "~ 1km from you | 123 Nguyen Trai str.",
    servicesLine: "Foots, hands, back, neck…",
    slotLabels: ["today", "09:00", "10:00"],
  },
  {
    id: "p2",
    name: "Lan Anh",
    imageSrc: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop",
    rating: 4.9,
    metaLine: "~ 3km from you | Duong Dong",
    servicesLine: "Thai, Swedish, reflexology…",
    slotLabels: ["today", "11:00", "15:00"],
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
