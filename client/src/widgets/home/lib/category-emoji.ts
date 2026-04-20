/** Эмодзи для чипов категорий на главной (циклически по индексу). */
const EMOJIS = [
  "💆",
  "🧘",
  "✋",
  "🦶",
  "⭐",
  "💆‍♀️",
  "🌿",
  "🔥",
] as const;

export function categoryEmojiFromIndex(index: number): string {
  return EMOJIS[index % EMOJIS.length]!;
}
