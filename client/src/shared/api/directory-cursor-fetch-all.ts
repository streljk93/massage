import type { Client } from "./generated/sdk/client";
import {
  organizationsList,
  specialistsList,
} from "./generated/sdk";
import type {
  OrganizationsListResponse,
  SpecialistsListResponse,
} from "./generated/sdk/types.gen";
import { CATALOG_MAJOR_CATEGORY_SLUG } from "../config/catalog-major-category";
import { DIRECTORY_CURSOR_FETCH_CHUNK_MAX } from "../config/directory-cursor-pagination";
import type { AppLocale } from "@/app/i18n/routing";

export type DirectoryCursorFetchRadius = {
  radiusM: number;
  radiusLat: number;
  radiusLng: number;
};

/** Один в один с запросом списка на /search, чтобы курсор и набор совпадали. */
export type DirectoryFetchAllListQuery = {
  sort: "recommended" | "popularity" | "newest" | "price_asc" | "price_desc" | "rating";
  q?: string;
  /** CSV slug категорий */
  categories?: string;
  priceMinVnd?: number | null;
  priceMaxVnd?: number | null;
};

async function fetchAllPaged<T extends { cursorPage: { hasMore: boolean; nextCursor: string | null } }>(
  fetchPage: (cursor: string | undefined) => Promise<{ error: unknown; data?: T }>,
  pickItems: (page: T) => unknown[],
): Promise<unknown[]> {
  const items: unknown[] = [];
  let cursor: string | undefined;
  for (;;) {
    const res = await fetchPage(cursor);
    if (res.error || !res.data) {
      throw new Error("directory list page failed");
    }
    items.push(...pickItems(res.data));
    if (!res.data.cursorPage.hasMore) {
      break;
    }
    const next = res.data.cursorPage.nextCursor;
    if (!next) {
      break;
    }
    cursor = next;
  }
  return items;
}

/** Первая страница списка специалистов с заданным `limit` (без обхода курсора). */
export async function fetchSpecialistsListLimited(options: {
  client: Client;
  locale: AppLocale;
  limit: number;
  fetch?: typeof fetch;
}): Promise<SpecialistsListResponse["specialists"]> {
  const res = await specialistsList({
    client: options.client,
    query: {
      locale: options.locale,
      majorSlug: CATALOG_MAJOR_CATEGORY_SLUG,
      limit: options.limit,
    },
    fetch: options.fetch,
  });
  if (res.error || !res.data) {
    throw new Error("specialists list failed");
  }
  return res.data.specialists;
}

/** Первая страница списка организаций с заданным `limit`. */
export async function fetchOrganizationsListLimited(options: {
  client: Client;
  locale: AppLocale;
  limit: number;
  fetch?: typeof fetch;
}): Promise<OrganizationsListResponse["organizations"]> {
  const res = await organizationsList({
    client: options.client,
    query: {
      locale: options.locale,
      majorSlug: CATALOG_MAJOR_CATEGORY_SLUG,
      limit: options.limit,
    },
    fetch: options.fetch,
  });
  if (res.error || !res.data) {
    throw new Error("organizations list failed");
  }
  return res.data.organizations;
}

/** Все страницы списка специалистов (для карты / домашней витрины). */
export async function fetchAllSpecialistsPages(options: {
  client: Client;
  locale: AppLocale;
  fetch?: typeof fetch;
  /** Если задан, совпадает с фильтром радиуса в поиске (гео на бэке). */
  radius?: DirectoryCursorFetchRadius | null;
  /** Как в GET /specialists на экране поиска: сужает набор, иначе на карте «всё подряд». */
  listQuery?: DirectoryFetchAllListQuery | null;
}): Promise<SpecialistsListResponse["specialists"]> {
  const r = options.radius;
  const lq = options.listQuery;
  const sort = lq?.sort ?? "popularity";
  const rows = await fetchAllPaged<SpecialistsListResponse>(
    (cursor) =>
      specialistsList({
        client: options.client,
        query: {
          locale: options.locale,
          majorSlug: CATALOG_MAJOR_CATEGORY_SLUG,
          limit: DIRECTORY_CURSOR_FETCH_CHUNK_MAX,
          sort,
          ...(cursor ? { cursor } : {}),
          ...(lq?.q?.trim() ? { q: lq.q.trim() } : {}),
          ...(lq?.categories ? { categories: lq.categories } : {}),
          ...(lq?.priceMinVnd != null ? { priceMinVnd: lq.priceMinVnd } : {}),
          ...(lq?.priceMaxVnd != null ? { priceMaxVnd: lq.priceMaxVnd } : {}),
          ...(r != null ?
            { radiusM: r.radiusM, radiusLat: r.radiusLat, radiusLng: r.radiusLng }
          : {}),
        },
        fetch: options.fetch,
      }),
    (p) => p.specialists,
  );
  return rows as SpecialistsListResponse["specialists"];
}

/** Все страницы списка организаций. */
export async function fetchAllOrganizationsPages(options: {
  client: Client;
  locale: AppLocale;
  fetch?: typeof fetch;
  /** Если задан, совпадает с фильтром радиуса в поиске (гео на бэке). */
  radius?: DirectoryCursorFetchRadius | null;
  /** Как в GET /organizations на экране поиска. */
  listQuery?: DirectoryFetchAllListQuery | null;
}): Promise<OrganizationsListResponse["organizations"]> {
  const r = options.radius;
  const lq = options.listQuery;
  const sort = lq?.sort ?? "popularity";
  const rows = await fetchAllPaged<OrganizationsListResponse>(
    (cursor) =>
      organizationsList({
        client: options.client,
        query: {
          locale: options.locale,
          majorSlug: CATALOG_MAJOR_CATEGORY_SLUG,
          limit: DIRECTORY_CURSOR_FETCH_CHUNK_MAX,
          sort,
          ...(cursor ? { cursor } : {}),
          ...(lq?.q?.trim() ? { q: lq.q.trim() } : {}),
          ...(lq?.categories ? { categories: lq.categories } : {}),
          ...(r != null ?
            { radiusM: r.radiusM, radiusLat: r.radiusLat, radiusLng: r.radiusLng }
          : {}),
        },
        fetch: options.fetch,
      }),
    (p) => p.organizations,
  );
  return rows as OrganizationsListResponse["organizations"];
}
