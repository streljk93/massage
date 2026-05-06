import {
  searchCategoriesQueryCsv,
  type SearchDirectoryListSort,
  parseSearchDirectoryListSort,
  SEARCH_DIRECTORY_DEFAULT_SORT,
} from "./search-directory-list-api-filters";
import {
  type SearchTab,
  parseSearchTab,
  searchTabQueryValue,
} from "@/shared/lib/search-tab";

export type SearchUrlFilters = {
  tab: SearchTab;
  q: string;
  orgCategorySlugs: string[];
  specCategorySlugs: string[];
  orgBodyZoneSlugs: string[];
  specBodyZoneSlugs: string[];
  specialistGender: "male" | "female" | null;
  /** Общий для обеих вкладок (салоны / специалисты). */
  sort: SearchDirectoryListSort;
  priceMinVnd: number | null;
  priceMaxVnd: number | null;
  /** `yyyy-MM-dd` в календаре витрины; в паре с `slotTime` — фильтр по свободному слоту. */
  slotDay: string | null;
  /** `HH:mm`; в паре с `slotDay` — показывать только с совпадением в сетке. */
  slotTime: string | null;
  /**
   * Поиск по радиусу от точки (метры, WGS-84). Все три поля задаются вместе; иначе сбрасываются.
   */
  radiusM: number | null;
  radiusLat: number | null;
  radiusLng: number | null;
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

const RADIUS_M_MIN = 50;
const RADIUS_M_MAX = 500_000;

function parseRadiusTriplet(
  mRaw: string,
  latRaw: string,
  lngRaw: string,
): { radiusM: number; radiusLat: number; radiusLng: number } | null {
  const radiusM = Number.parseInt(mRaw.trim(), 10);
  const radiusLat = Number.parseFloat(latRaw.trim());
  const radiusLng = Number.parseFloat(lngRaw.trim());
  if (
    !Number.isFinite(radiusM) ||
    !Number.isFinite(radiusLat) ||
    !Number.isFinite(radiusLng)
  ) {
    return null;
  }
  if (
    radiusM < RADIUS_M_MIN ||
    radiusM > RADIUS_M_MAX ||
    radiusLat < -90 ||
    radiusLat > 90 ||
    radiusLng < -180 ||
    radiusLng > 180
  ) {
    return null;
  }
  return { radiusM, radiusLat, radiusLng };
}

export function parseSearchUrlFiltersFromRecord(
  sp: Record<string, string | string[] | undefined>,
): SearchUrlFilters {
  const u = new URLSearchParams();
  const keys = [
    "tab",
    "q",
    "sort",
    "orgCat",
    "specCat",
    "category",
    "orgBodyZones",
    "specBodyZones",
    "bodyZones",
    "gender",
    "priceMin",
    "priceMax",
    "slotDay",
    "slotTime",
    "radiusM",
    "radiusLat",
    "radiusLng",
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
  let orgBodyZoneSlugs = parseCategorySlugsParam(
    getParam(searchParams, "orgBodyZones"),
  );
  let specBodyZoneSlugs = parseCategorySlugsParam(
    getParam(searchParams, "specBodyZones"),
  );
  const legacyBodyZones = getParam(searchParams, "bodyZones").trim().toLowerCase();
  if (orgBodyZoneSlugs.length === 0 && specBodyZoneSlugs.length === 0 && legacyBodyZones) {
    const both = parseCategorySlugsParam(legacyBodyZones);
    orgBodyZoneSlugs = both;
    specBodyZoneSlugs = both;
  }
  const rawGender = getParam(searchParams, "gender").trim().toLowerCase();
  const specialistGender =
    rawGender === "male" || rawGender === "female" ?
      (rawGender as "male" | "female")
    : null;
  let priceMinVnd = parsePrice(getParam(searchParams, "priceMin"));
  let priceMaxVnd = parsePrice(getParam(searchParams, "priceMax"));
  if (priceMinVnd != null && priceMaxVnd != null && priceMinVnd > priceMaxVnd) {
    const t = priceMinVnd;
    priceMinVnd = priceMaxVnd;
    priceMaxVnd = t;
  }
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  const HM = /^\d{1,2}:\d{2}$/;
  const rawDay = getParam(searchParams, "slotDay").trim();
  const rawTime = getParam(searchParams, "slotTime").trim();
  let slotDay: string | null = ISO_DATE.test(rawDay) ? rawDay : null;
  let slotTime: string | null = HM.test(rawTime) ? rawTime : null;
  if (slotDay == null || slotTime == null) {
    slotDay = null;
    slotTime = null;
  }
  const rawRM = getParam(searchParams, "radiusM");
  const rawRLat = getParam(searchParams, "radiusLat");
  const rawRLng = getParam(searchParams, "radiusLng");
  const radiusPack =
    rawRM.trim() && rawRLat.trim() && rawRLng.trim() ?
      parseRadiusTriplet(rawRM, rawRLat, rawRLng)
    : null;
  const sort = parseSearchDirectoryListSort(getParam(searchParams, "sort"));
  return {
    tab,
    q,
    orgCategorySlugs,
    specCategorySlugs,
    orgBodyZoneSlugs,
    specBodyZoneSlugs,
    specialistGender,
    sort,
    priceMinVnd,
    priceMaxVnd,
    slotDay,
    slotTime,
    radiusM: radiusPack?.radiusM ?? null,
    radiusLat: radiusPack?.radiusLat ?? null,
    radiusLng: radiusPack?.radiusLng ?? null,
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
    orgBodyZoneSlugs: patch.orgBodyZoneSlugs ?? current.orgBodyZoneSlugs,
    specBodyZoneSlugs: patch.specBodyZoneSlugs ?? current.specBodyZoneSlugs,
    specialistGender:
      patch.specialistGender !== undefined ?
        patch.specialistGender
      : current.specialistGender,
    sort: patch.sort !== undefined ? patch.sort : current.sort,
    priceMinVnd:
      patch.priceMinVnd !== undefined ? patch.priceMinVnd : current.priceMinVnd,
    priceMaxVnd:
      patch.priceMaxVnd !== undefined ? patch.priceMaxVnd : current.priceMaxVnd,
    slotDay: patch.slotDay !== undefined ? patch.slotDay : current.slotDay,
    slotTime: patch.slotTime !== undefined ? patch.slotTime : current.slotTime,
    radiusM: patch.radiusM !== undefined ? patch.radiusM : current.radiusM,
    radiusLat:
      patch.radiusLat !== undefined ? patch.radiusLat : current.radiusLat,
    radiusLng:
      patch.radiusLng !== undefined ? patch.radiusLng : current.radiusLng,
  };
}

export type BuildSearchQueryStringOptions = {
  /** Вернуться на /search с открытой панелью фильтров (однократно; клиент снимет параметр). */
  filtersOneShot?: boolean;
};

/** Строка query без ведущего `?`; не включает legacy `category`. */
export function buildSearchQueryString(
  f: SearchUrlFilters,
  options?: BuildSearchQueryStringOptions,
): string {
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
  const orgBodyCsv = searchCategoriesQueryCsv(f.orgBodyZoneSlugs);
  if (orgBodyCsv) {
    sp.set("orgBodyZones", orgBodyCsv);
  }
  const specBodyCsv = searchCategoriesQueryCsv(f.specBodyZoneSlugs);
  if (specBodyCsv) {
    sp.set("specBodyZones", specBodyCsv);
  }
  if (f.specialistGender != null) {
    sp.set("gender", f.specialistGender);
  }
  if (f.priceMinVnd != null) {
    sp.set("priceMin", String(f.priceMinVnd));
  }
  if (f.priceMaxVnd != null) {
    sp.set("priceMax", String(f.priceMaxVnd));
  }
  if (f.slotDay != null && f.slotTime != null) {
    sp.set("slotDay", f.slotDay);
    sp.set("slotTime", f.slotTime);
  }
  if (f.radiusM != null && f.radiusLat != null && f.radiusLng != null) {
    sp.set("radiusM", String(f.radiusM));
    sp.set("radiusLat", String(f.radiusLat));
    sp.set("radiusLng", String(f.radiusLng));
  }
  if (f.sort !== SEARCH_DIRECTORY_DEFAULT_SORT) {
    sp.set("sort", f.sort);
  }
  if (options?.filtersOneShot) {
    sp.set("filters", "1");
  }
  return sp.toString();
}

/**
 * Ссылка на `/search/map` с теми же фильтрами, что и список. Опция `pickRadius` — выбор радиуса на карте.
 */
export function buildSearchMapQueryString(
  f: SearchUrlFilters,
  options?: { pickRadius?: boolean },
): string {
  const base = buildSearchQueryString(f);
  if (!options?.pickRadius) {
    return base;
  }
  const sp = new URLSearchParams(base);
  sp.set("pickRadius", "1");
  return sp.toString();
}
