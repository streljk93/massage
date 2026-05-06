const BODY_ZONE_APPLICABLE_MAJOR_SLUGS = new Set<string>(['massage']);

const MASSAGE_GENERAL_ZONE_SLUGS = [
  'full-body',
  'head',
  'face',
  'neck',
  'shoulders',
  'arms',
  'hands',
  'chest',
  'abdomen',
  'back-upper',
  'back-lower',
  'glutes',
  'thighs',
  'knees',
  'calves',
  'feet',
] as const;

const MASSAGE_CATEGORY_ALLOWED_BODY_ZONE_SLUGS: Record<string, readonly string[]> = {
  'foot-massage': ['feet', 'calves'],
  'neck-shoulder-back-therapy': ['neck', 'shoulders', 'back-upper', 'back-lower'],
  'thai-massage': MASSAGE_GENERAL_ZONE_SLUGS,
  'aroma-massage': MASSAGE_GENERAL_ZONE_SLUGS,
  'herbal-massage': MASSAGE_GENERAL_ZONE_SLUGS,
  'deep-tissue-massage': MASSAGE_GENERAL_ZONE_SLUGS,
  'hot-stone-massage': MASSAGE_GENERAL_ZONE_SLUGS,
  'prenatal-massage': MASSAGE_GENERAL_ZONE_SLUGS,
  'kids-massage': MASSAGE_GENERAL_ZONE_SLUGS,
  'hair-wash': ['head', 'face', 'neck', 'shoulders'],
  combo: MASSAGE_GENERAL_ZONE_SLUGS,
};

export function isBodyZoneApplicableForMajor(majorSlug: string): boolean {
  return BODY_ZONE_APPLICABLE_MAJOR_SLUGS.has(majorSlug);
}

export function getAllowedBodyZoneSlugsForCategory(args: {
  majorSlug: string;
  categorySlug: string;
}): readonly string[] {
  return getAllowedBodyZoneSlugsForCategories({
    majorSlug: args.majorSlug,
    categorySlugs: [args.categorySlug],
  });
}

export function getAllowedBodyZoneSlugsForCategories(args: {
  majorSlug: string;
  categorySlugs: string[];
}): readonly string[] {
  if (!isBodyZoneApplicableForMajor(args.majorSlug)) {
    return [];
  }
  if (args.majorSlug !== 'massage') {
    return [];
  }
  const allowed = new Set<string>();
  for (const categorySlug of args.categorySlugs) {
    const slugs = MASSAGE_CATEGORY_ALLOWED_BODY_ZONE_SLUGS[categorySlug] ?? [];
    for (const slug of slugs) {
      allowed.add(slug);
    }
  }
  return [...allowed];
}

