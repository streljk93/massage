import { searchCategoriesQueryCsv } from "./search-directory-list-api-filters";
import {
  type SearchTab,
  parseSearchTab,
  searchTabQueryValue,
} from "./search-tab";

export type SearchUrlFilters = {
  tab: SearchTab;
  q: string;
  orgCategorySlugs: string[];
  specCategorySlugs: string[];
  priceMinVnd: number | null;
  priceMaxVnd: number | null;
};

function firstParamValue(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const v = sp[key];
  if (typeof v === "string") {
    return v;
  }
  if (Array.isArray(v) && v[0] != null) {
    return String(v[0]);
  }
  return "";
}

function getParam(searchParams: URLSearchParams, key: string): string {
  return searchParams.get(key) ?? "";
}

/**
 * Разбор slug'ов из CSV в URL (уникальные, trim, lower, сортировка как в API).
 */
export function parseCategorySlugsParam(raw: string): string[] {
  if (!raw.trim()) {
    return [];
  }
  const parts = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(parts)].sort((a, b) => a.localeCompare(b));
}

function parsePrice(raw: string): number | null {
  if (!raw.trim()) {
    return null;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export function parseSearchUrlFiltersFromRecord(
  sp: Record<string, string | string[] | undefined>,
): SearchUrlFilters {
  const u = new URLSearchParams();
  const keys = [
    "tab",
    "q",
    "orgCat",
    "specCat",
    "category",
    "priceMin",
    "priceMax",
  ] as const;
  for (const key of keys) {
    const v = firstParamValue(sp, key);
    if (v) {
      u.set(key, v);
    }
  }
  return parseSearchUrlFilters(u);
}

export function parseSearchUrlFilters(
  searchParams: URLSearchParams,
): SearchUrlFilters {
  const tab = parseSearchTab(getParam(searchParams, "tab") || null);
  const q = getParam(searchParams, "q");
  let orgCategorySlugs = parseCategorySlugsParam(getParam(searchParams, "orgCat"));
  let specCategorySlugs = parseCategorySlugsParam(
    getParam(searchParams, "specCat"),
  );
  const legacy = getParam(searchParams, "category").trim().toLowerCase();
  if (
    orgCategorySlugs.length === 0 &&
    specCategorySlugs.length === 0 &&
    legacy
  ) {
    orgCategorySlugs = [legacy];
    specCategorySlugs = [legacy];
  }
  let priceMinVnd = parsePrice(getParam(searchParams, "priceMin"));
  let priceMaxVnd = parsePrice(getParam(searchParams, "priceMax"));
  if (priceMinVnd != null && priceMaxVnd != null && priceMinVnd > priceMaxVnd) {
    const t = priceMinVnd;
    priceMinVnd = priceMaxVnd;
    priceMaxVnd = t;
  }
  return {
    tab,
    q,
    orgCategorySlugs,
    specCategorySlugs,
    priceMinVnd,
    priceMaxVnd,
  };
}

export function applySearchUrlPatch(
  current: SearchUrlFilters,
  patch: Partial<SearchUrlFilters>,
): SearchUrlFilters {
  return {
    tab: patch.tab ?? current.tab,
    q: patch.q !== undefined ? patch.q : current.q,
    orgCategorySlugs: patch.orgCategorySlugs ?? current.orgCategorySlugs,
    specCategorySlugs: patch.specCategorySlugs ?? current.specCategorySlugs,
    priceMinVnd:
      patch.priceMinVnd !== undefined ? patch.priceMinVnd : current.priceMinVnd,
    priceMaxVnd:
      patch.priceMaxVnd !== undefined ? patch.priceMaxVnd : current.priceMaxVnd,
  };
}

/** Строка query без ведущего `?`; не включает legacy `category`. */
export function buildSearchQueryString(f: SearchUrlFilters): string {
  const sp = new URLSearchParams();
  sp.set("tab", searchTabQueryValue(f.tab));
  const qTrim = f.q.trim();
  if (qTrim) {
    sp.set("q", qTrim);
  }
  const orgCsv = searchCategoriesQueryCsv(f.orgCategorySlugs);
  if (orgCsv) {
    sp.set("orgCat", orgCsv);
  }
  const specCsv = searchCategoriesQueryCsv(f.specCategorySlugs);
  if (specCsv) {
    sp.set("specCat", specCsv);
  }
  if (f.priceMinVnd != null) {
    sp.set("priceMin", String(f.priceMinVnd));
  }
  if (f.priceMaxVnd != null) {
    sp.set("priceMax", String(f.priceMaxVnd));
  }
  return sp.toString();
}
