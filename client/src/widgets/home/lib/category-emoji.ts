/**
 * Emoji подкатегорий «Массаж» на главной: по `slug` из каталога,
 * иначе — циклический запасной набор.
 */
const MASSAGE_CATEGORY_EMOJI_BY_SLUG: Record<string, string> = {
  "thai-massage": "🙏",
  "aroma-massage": "🌸",
  "herbal-massage": "🌿",
  "deep-tissue-massage": "💪",
  "hot-stone-massage": "♨️",
  "foot-massage": "🦶",
  "hair-wash": "💆",
  "prenatal-massage": "🤰",
  "kids-massage": "👶",
  "neck-shoulder-back-therapy": "🧘",
  combo: "✨",
};

const FALLBACK_EMOJIS = ["💆", "🌿", "🦶", "🌊", "✨", "🧘"] as const;

export function categoryEmojiFromIndex(index: number): string {
  return FALLBACK_EMOJIS[index % FALLBACK_EMOJIS.length]!;
}

/** Emoji для категории массажа: по slug, иначе по индексу. */
export function massageCategoryEmoji(slug: string, index: number): string {
  const key = slug.trim().toLowerCase();
  return MASSAGE_CATEGORY_EMOJI_BY_SLUG[key] ?? categoryEmojiFromIndex(index);
}
