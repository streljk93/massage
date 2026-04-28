/**
 * Локалитет из `address_components` (Google / совместимые схемы).
 */
type ComponentLike = {
  long_name: string;
  types: string[];
};

export function extractLocalityFromAddressComponents(
  components: ComponentLike[] | null | undefined,
): string | null {
  if (!components?.length) {
    return null;
  }
  const tryTypes = [
    'locality',
    'sublocality',
    'sublocality_level_1',
    'postal_town',
    'administrative_area_level_2',
  ] as const;
  for (const t of tryTypes) {
    const c = components.find((x) => x.types.includes(t));
    if (c?.long_name) {
      return c.long_name.slice(0, 120);
    }
  }
  const admin1 = components.find((x) =>
    x.types.includes('administrative_area_level_1'),
  );
  return admin1?.long_name ? admin1.long_name.slice(0, 120) : null;
}
