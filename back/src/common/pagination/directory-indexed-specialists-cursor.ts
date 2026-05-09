import type { DirectoryListSort } from './directory-list-sort';

/** Смена схемы курсора: v2 был offset без группировки; v3 — страница + group_by specialistId. */
const INDEXED_CURSOR_VERSION = 3;

/**
 * Курсор пагинации при `SEARCH_LISTING_BACKEND=indexed` (Typesense, не совместим с SQL keyset).
 */
export type DecodedDirectoryIndexedSpecialistsCursor = {
  sort: DirectoryListSort;
  /** Страница Typesense для сгруппированного поиска (1-based). */
  page: number;
};

export function encodeDirectoryIndexedSpecialistsCursor(
  sort: DirectoryListSort,
  page: number,
): string {
  const p = Math.max(1, Math.floor(page));
  return Buffer.from(
    JSON.stringify({
      v: INDEXED_CURSOR_VERSION,
      kb: 'didx_edge',
      s: sort,
      p,
    }),
    'utf8',
  ).toString('base64url');
}

export function decodeDirectoryIndexedSpecialistsCursor(
  token: string,
): DecodedDirectoryIndexedSpecialistsCursor | null {
  const raw = (() => {
    try {
      return Buffer.from(token, 'base64url').toString('utf8');
    } catch {
      return null;
    }
  })();
  if (raw == null) {
    return null;
  }
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (
      p.v !== INDEXED_CURSOR_VERSION ||
      p.kb !== 'didx_edge' ||
      typeof p.s !== 'string' ||
      typeof p.p !== 'number' ||
      !Number.isFinite(p.p) ||
      p.p < 1
    ) {
      return null;
    }
    return {
      sort: p.s as DirectoryListSort,
      page: Math.floor(p.p),
    };
  } catch {
    return null;
  }
}
