/**
 * Иконки для подкатегорий «Массаж» на главной: по `slug` из каталога, иначе — циклический запасной набор.
 * Слуги совпадают с `massageCategorySeeds` / `serviceCategoryI18n` в `back/prisma/seed-catalog-i18n.mjs`.
 */
const MASSAGE_CATEGORY_EMOJI_BY_SLUG: Record<string, string> = {
  neck: "🤲",
  body: "🧴",
  legs: "🦵",
  spa: "🛁",
  back: "🖐️",
  arms: "💪",
  face: "✨",
  relaxing: "🌙",
  sports: "🏃",
  head: "💆",
  lymphatic: "💧",
  thai: "🙏",
  "hot-stone": "🪨",
  "anti-cellulite": "🎯",
  honey: "🍯",
  "feet-reflexology": "🦶",
  pressotherapy: "💨",
  pregnancy: "🤰",
  aroma: "🌿",
  classic: "✋",
};

const FALLBACK_EMOJIS = [
  "💆",
  "🧴",
  "🦵",
  "🛁",
  "🤲",
  "🌿",
  "✨",
  "🙏",
  "💧",
  "🪨",
] as const;

export function categoryEmojiFromIndex(index: number): string {
  return FALLBACK_EMOJIS[index % FALLBACK_EMOJIS.length]!;
}

/** Эмодзи для чипа категории массажа: по slug, иначе по индексу в запасном наборе. */
export function massageCategoryEmoji(slug: string, index: number): string {
  const key = slug.trim().toLowerCase();
  const bySlug = MASSAGE_CATEGORY_EMOJI_BY_SLUG[key];
  if (bySlug) {
    return bySlug;
  }
  return categoryEmojiFromIndex(index);
}
