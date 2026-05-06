import type { LucideIcon } from "lucide-react";
import {
  Baby,
  Circle,
  Droplets,
  FlaskConical,
  Footprints,
  Hand,
  HeartPulse,
  Leaf,
  Sparkles,
  Target,
  UserRound,
  Waves,
} from "lucide-react";

/**
 * Иконки подкатегорий «Массаж» на главной: по `slug` из каталога,
 * иначе — циклический запасной набор.
 */
const MASSAGE_CATEGORY_ICON_BY_SLUG: Record<string, LucideIcon> = {
  "thai-massage": Sparkles,
  "aroma-massage": FlaskConical,
  "herbal-massage": Leaf,
  "deep-tissue-massage": Target,
  "hot-stone-massage": Circle,
  "foot-massage": Footprints,
  "hair-wash": Droplets,
  "prenatal-massage": HeartPulse,
  "kids-massage": Baby,
  "neck-shoulder-back-therapy": UserRound,
  combo: Sparkles,
};

const FALLBACK_ICONS: readonly LucideIcon[] = [
  Hand,
  Leaf,
  Footprints,
  Waves,
  Sparkles,
  UserRound,
] as const;

export function categoryIconFromIndex(index: number): LucideIcon {
  return FALLBACK_ICONS[index % FALLBACK_ICONS.length]!;
}

/** Иконка для категории массажа: по slug, иначе по индексу. */
export function massageCategoryIcon(slug: string, index: number): LucideIcon {
  const key = slug.trim().toLowerCase();
  return MASSAGE_CATEGORY_ICON_BY_SLUG[key] ?? categoryIconFromIndex(index);
}
