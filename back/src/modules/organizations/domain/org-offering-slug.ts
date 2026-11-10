/** Slug оффера точки: уникален в пределах организации. */
export function buildOrgOfferingSlug(
  orgSlug: string,
  categorySlug: string,
): string {
  const base = `offer-${orgSlug}-${categorySlug}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '');
  return base.length > 120 ? base.slice(0, 120) : base;
}
