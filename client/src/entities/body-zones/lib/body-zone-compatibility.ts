const MASSAGE_GENERAL_ZONE_SLUGS = [
  "full-body",
  "head",
  "face",
  "neck",
  "shoulders",
  "arms",
  "hands",
  "chest",
  "abdomen",
  "back-upper",
  "back-lower",
  "glutes",
  "thighs",
  "knees",
  "calves",
  "feet",
] as const;

const CATEGORY_ALLOWED_BODY_ZONES: Record<string, readonly string[]> = {
  "foot-massage": ["feet", "calves"],
  "neck-shoulder-back-therapy": ["neck", "shoulders", "back-upper", "back-lower"],
  "thai-massage": MASSAGE_GENERAL_ZONE_SLUGS,
  "aroma-massage": MASSAGE_GENERAL_ZONE_SLUGS,
  "herbal-massage": MASSAGE_GENERAL_ZONE_SLUGS,
  "deep-tissue-massage": MASSAGE_GENERAL_ZONE_SLUGS,
  "hot-stone-massage": MASSAGE_GENERAL_ZONE_SLUGS,
  "prenatal-massage": MASSAGE_GENERAL_ZONE_SLUGS,
  "kids-massage": MASSAGE_GENERAL_ZONE_SLUGS,
  "hair-wash": ["head", "face", "neck", "shoulders"],
  combo: MASSAGE_GENERAL_ZONE_SLUGS,
};

export function getAllowedBodyZoneSlugsForCategorySlug(
  categorySlug: string | null | undefined,
): string[] {
  return getAllowedBodyZoneSlugsForCategorySlugs(
    categorySlug ? [categorySlug] : [],
  );
}

export function getAllowedBodyZoneSlugsForCategorySlugs(
  categorySlugs: Array<string | null | undefined>,
): string[] {
  const allowed = new Set<string>();
  for (const categorySlug of categorySlugs) {
    if (!categorySlug) {
      continue;
    }
    const slugs = CATEGORY_ALLOWED_BODY_ZONES[categorySlug] ?? [];
    for (const slug of slugs) {
      allowed.add(slug);
    }
  }
  return [...allowed];
}

export function normalizeBodyZoneSlugsForCategories(args: {
  selectedSlugs: string[];
  categorySlugs: Array<string | null | undefined>;
}): string[] {
  const allowed = new Set(
    getAllowedBodyZoneSlugsForCategorySlugs(args.categorySlugs),
  );
  if (allowed.size === 0) {
    return [];
  }
  const unique = [...new Set(args.selectedSlugs)];
  const filtered = unique.filter((slug) => allowed.has(slug));
  if (filtered.includes("full-body")) {
    return ["full-body"];
  }
  return filtered;
}

export function defaultBodyZoneSlugsForCategorySlugs(
  categorySlugs: Array<string | null | undefined>,
): string[] {
  const allowed = getAllowedBodyZoneSlugsForCategorySlugs(categorySlugs);
  if (allowed.length === 0) {
    return [];
  }
  return allowed.includes("full-body") ? ["full-body"] : allowed;
}

export function normalizeBodyZoneSlugsForCategory(args: {
  selectedSlugs: string[];
  categorySlug: string | null | undefined;
}): string[] {
  return normalizeBodyZoneSlugsForCategories({
    selectedSlugs: args.selectedSlugs,
    categorySlugs: [args.categorySlug],
  });
}

export function defaultBodyZoneSlugsForCategorySlug(
  categorySlug: string | null | undefined,
): string[] {
  return defaultBodyZoneSlugsForCategorySlugs([categorySlug]);
}

const FULL_BODY_ZONE_SLUG = "full-body";

/**
 * Зоны «все включены по умолчанию» в селекторе: перечисляем все части тела из каталога,
 * чтобы пользователь мог снимать лишнее. Если в UI доступен только full-body — остаётся он.
 */
export function allSelectableBodyZoneSlugsDefault(
  selectableSlugsInUiOrder: string[],
): string[] {
  const nonFull = selectableSlugsInUiOrder.filter((s) => s !== FULL_BODY_ZONE_SLUG);
  if (nonFull.length > 0) {
    return nonFull;
  }
  return selectableSlugsInUiOrder.includes(FULL_BODY_ZONE_SLUG)
    ? [FULL_BODY_ZONE_SLUG]
    : [];
}


