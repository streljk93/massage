import type { BookingListStatus } from "@/entities/booking";

export type BookingsPageMockItem = {
  id: string;
  status: BookingListStatus;
  pendingTime?: string;
  providerName: string;
  categoryShortNameKey: "booking.demoFootMassage";
  amount: number;
  currency: string;
  dateLabelKey: "booking.today";
  timeRange: string;
  avatarSrc: string;
};

export type BookingsHistoryMockItem = {
  id: string;
  providerName: string;
  categoryShortNameKey: "booking.demoFootMassage";
  amount: number;
  currency: string;
  /** Дата визита для строки (как в макете). */
  dateDisplay: string;
  timeRange: string;
  avatarSrc: string;
  reviewed: boolean;
  rating?: number;
  reviewSnippetKey?: "historyReview1" | "historyReview2" | "historyReview3";
};

export const bookingsNewMock: BookingsPageMockItem[] = [
  {
    id: "1",
    status: "pending",
    pendingTime: "14:32",
    providerName: "Nha Trang",
    categoryShortNameKey: "booking.demoFootMassage",
    amount: 500_000,
    currency: "VND",
    dateLabelKey: "booking.today",
    timeRange: "14:00 – 15:30",
    avatarSrc:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128&h=128&fit=crop",
  },
  {
    id: "2",
    status: "confirmed",
    providerName: "Nha Trang",
    categoryShortNameKey: "booking.demoFootMassage",
    amount: 500_000,
    currency: "VND",
    dateLabelKey: "booking.today",
    timeRange: "14:00 – 15:30",
    avatarSrc:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128&h=128&fit=crop",
  },
  {
    id: "3",
    status: "expired",
    providerName: "Nha Trang",
    categoryShortNameKey: "booking.demoFootMassage",
    amount: 500_000,
    currency: "VND",
    dateLabelKey: "booking.today",
    timeRange: "14:00 – 15:30",
    avatarSrc:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128&h=128&fit=crop",
  },
  {
    id: "4",
    status: "rejected",
    providerName: "Nha Trang",
    categoryShortNameKey: "booking.demoFootMassage",
    amount: 500_000,
    currency: "VND",
    dateLabelKey: "booking.today",
    timeRange: "14:00 – 15:30",
    avatarSrc:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128&h=128&fit=crop",
  },
];

/** Прошлые записи: без статуса сверху, блок даты и секция отзыва. */
export const bookingsHistoryMock: BookingsHistoryMockItem[] = [
  {
    id: "h1",
    providerName: "Nha Trang",
    categoryShortNameKey: "booking.demoFootMassage",
    amount: 500_000,
    currency: "VND",
    dateDisplay: "24.08.2024",
    timeRange: "14:00 – 15:30",
    avatarSrc:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128&h=128&fit=crop",
    reviewed: false,
  },
  {
    id: "h2",
    providerName: "Nha Trang",
    categoryShortNameKey: "booking.demoFootMassage",
    amount: 500_000,
    currency: "VND",
    dateDisplay: "18.08.2024",
    timeRange: "14:00 – 15:30",
    avatarSrc:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128&h=128&fit=crop",
    reviewed: true,
    rating: 4,
    reviewSnippetKey: "historyReview1",
  },
  {
    id: "h3",
    providerName: "Nha Trang",
    categoryShortNameKey: "booking.demoFootMassage",
    amount: 500_000,
    currency: "VND",
    dateDisplay: "10.08.2024",
    timeRange: "11:00 – 12:00",
    avatarSrc:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128&h=128&fit=crop",
    reviewed: true,
    rating: 5,
    reviewSnippetKey: "historyReview2",
  },
  {
    id: "h4",
    providerName: "Da Lat Spa",
    categoryShortNameKey: "booking.demoFootMassage",
    amount: 450_000,
    currency: "VND",
    dateDisplay: "02.08.2024",
    timeRange: "10:00 – 11:00",
    avatarSrc:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=128&h=128&fit=crop",
    reviewed: true,
    rating: 4,
    reviewSnippetKey: "historyReview3",
  },
];
