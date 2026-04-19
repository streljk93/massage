import type { AppLocale } from "./routing";
import type { ColocatedI18nBundle } from "./types";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function deepMergeMessages(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...target };
  for (const key of Object.keys(source)) {
    const s = source[key];
    const t = out[key];
    if (isPlainObject(s) && isPlainObject(t)) {
      out[key] = deepMergeMessages(t, s);
    } else {
      out[key] = s;
    }
  }
  return out;
}

export function mergeBundlesForLocale(
  locale: string,
  bundles: ColocatedI18nBundle[],
): Record<string, unknown> {
  return bundles.reduce<Record<string, unknown>>((acc, bundle) => {
    const slice = bundle.messages[locale as AppLocale];
    if (!slice) return acc;
    return deepMergeMessages(acc, slice);
  }, {});
}
