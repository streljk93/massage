type DayKey = "today" | "tomorrow";

export type LandingSlotSeed = {
  dayKey: DayKey;
  times: string[];
};

export type LandingSpecialistSlideSeed = {
  id: "sp1" | "sp2" | "sp3" | "sp4" | "sp5";
  imageSrc: string;
  rating: number;
  slotGroups: LandingSlotSeed[];
};

export type LandingSalonRowSeed = {
  id: "sl1" | "sl2" | "sl3" | "sl4";
  imageSrc: string;
};

/** Демо: совпадает по духу с карточками на главной; подписи — из i18n страницы. */
export const landingSpecialistSlides: LandingSpecialistSlideSeed[] = [
  {
    id: "sp1",
    imageSrc:
      "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400&h=500&fit=crop&q=80",
    rating: 4.9,
    slotGroups: [
      { dayKey: "today", times: ["09:00", "10:00"] },
      { dayKey: "tomorrow", times: ["11:00", "16:00"] },
    ],
  },
  {
    id: "sp2",
    imageSrc:
      "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=500&fit=crop&q=80",
    rating: 4.9,
    slotGroups: [
      { dayKey: "today", times: ["11:00", "15:00"] },
      { dayKey: "tomorrow", times: ["09:30", "13:00", "17:00"] },
    ],
  },
  {
    id: "sp3",
    imageSrc:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop&q=80",
    rating: 4.7,
    slotGroups: [
      { dayKey: "today", times: ["08:00", "14:00"] },
      { dayKey: "tomorrow", times: ["10:00", "16:00"] },
    ],
  },
  {
    id: "sp4",
    imageSrc:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=500&fit=crop&q=80",
    rating: 4.8,
    slotGroups: [
      { dayKey: "today", times: ["09:00", "13:30"] },
      { dayKey: "tomorrow", times: ["11:00", "15:30"] },
    ],
  },
  {
    id: "sp5",
    imageSrc:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=500&fit=crop&q=80",
    rating: 4.6,
    slotGroups: [
      { dayKey: "today", times: ["10:30", "17:00"] },
      { dayKey: "tomorrow", times: ["08:30", "12:30"] },
    ],
  },
];

export const landingSalonRows: LandingSalonRowSeed[] = [
  {
    id: "sl1",
    imageSrc:
      "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=200&h=200&fit=crop&q=80",
  },
  {
    id: "sl2",
    imageSrc:
      "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=200&h=200&fit=crop&q=80",
  },
  {
    id: "sl3",
    imageSrc:
      "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=200&h=200&fit=crop&q=80",
  },
  {
    id: "sl4",
    imageSrc:
      "https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=200&h=200&fit=crop&q=80",
  },
];
