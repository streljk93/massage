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

/** Группы слотов на карточке каталога: `calendarDate` — yyyy-MM-dd (Asia/Ho_Chi_Minh). */
export type SlotGroupSeed = { calendarDate: string; times: string[] };

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
