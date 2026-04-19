import type { SpecialistSearchOption } from "@/entities/specialists";

export const homeUser = {
  firstName: "Evgenii",
  locationLabel: "Phu Quoc",
  avatarSrc: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=128&h=128&fit=crop",
};

export const specialistSearchOptions: SpecialistSearchOption[] = [
  { id: "1", label: "Nguyễn Ngọc", subtitle: "Foot massage · 1 km" },
  { id: "2", label: "Lan Anh", subtitle: "Thai massage · 2 km" },
  { id: "3", label: "Minh Tuấn", subtitle: "Sports massage · 3 km" },
  { id: "4", label: "Thu Hà", subtitle: "Neck & back · 0.5 km" },
];

export const categories = [
  { id: "neck", label: "Neck", emoji: "🧘" },
  { id: "body", label: "Body", emoji: "✋" },
  { id: "foot", label: "Foot", emoji: "🦶" },
  { id: "spa", label: "Spa", emoji: "💆" },
  { id: "combo", label: "Combo", emoji: "⭐" },
];

export const currentBooking = {
  specialistName: "Nha Trang",
  serviceLine: "Massage foot 500 000 VND",
  dateLabel: "Today",
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
    title: "Discount 25%",
    subtitle: "For new clients",
    cta: "Registration",
    imageSrc:
      "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=400&h=300&fit=crop",
  },
  {
    id: "promo-2",
    title: "Free hot stone",
    subtitle: "Book this week",
    cta: "Book now",
    imageSrc:
      "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=300&fit=crop",
  },
];
