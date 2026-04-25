import type { DirectoryListSort } from './directory-list-sort';

const CURSOR_VERSION = 1 as const;

/** Курсор со смещением (рекомендации, цена). */
export type DecodedSpecialistOffsetCursor = {
  sort: 'recommended' | 'price_asc' | 'price_desc';
  offset: number;
};

export type DecodedSpecialistListCursor =
  | DecodedSpecialistOffsetCursor
  /** `ratingAverage` в курсоре — с момента ввода tie-break по рейтингу; без поля — старые курсоры. */
  | {
      sort: 'popularity';
      reviewsCount: number;
      id: string;
      ratingAverage?: number;
    }
  | { sort: 'newest'; createdAtIso: string; id: string }
  | { sort: 'rating'; ratingAverage: number; id: string };

export type DecodedOrganizationOffsetCursor = {
  sort: 'recommended' | 'price_asc' | 'price_desc';
  offset: number;
};

export type DecodedOrganizationListCursor =
  | DecodedOrganizationOffsetCursor
  | {
      sort: 'popularity';
      reviewsCount: number;
      id: string;
      ratingAverage?: number;
    }
  | { sort: 'newest'; createdAtIso: string; id: string }
  | { sort: 'rating'; ratingAverage: number; id: string };

function toBase64Url(json: string): string {
  return Buffer.from(json, 'utf8').toString('base64url');
}

function fromBase64Url(token: string): string | null {
  try {
    return Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

export function encodeSpecialistListCursor(args: {
  sort: DirectoryListSort;
  specialistId: string;
  userName?: string;
  reviewsCount?: number;
  createdAt?: Date;
  ratingAverage?: number;
  offset?: number;
}): string {
  const { sort } = args;
  if (sort === 'recommended' || sort === 'price_asc' || sort === 'price_desc') {
    const o = args.offset;
    if (typeof o !== 'number' || !Number.isFinite(o) || o < 0) {
      throw new Error(
        'encodeSpecialistListCursor: offset required for offset sorts',
      );
    }
    return toBase64Url(
      JSON.stringify({
        v: CURSOR_VERSION,
        k: 'sp',
        s: sort,
        o: Math.floor(o),
      }),
    );
  }
  if (sort === 'popularity') {
    const c = args.reviewsCount;
    if (typeof c !== 'number' || !Number.isFinite(c)) {
      throw new Error(
        'encodeSpecialistListCursor: popularity needs reviewsCount',
      );
    }
    const a = args.ratingAverage;
    if (typeof a !== 'number' || !Number.isFinite(a)) {
      throw new Error(
        'encodeSpecialistListCursor: popularity needs ratingAverage',
      );
    }
    return toBase64Url(
      JSON.stringify({
        v: CURSOR_VERSION,
        k: 'sp',
        s: 'popularity',
        c,
        a,
        i: args.specialistId,
      }),
    );
  }
  if (sort === 'newest') {
    const d = args.createdAt;
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
      throw new Error('encodeSpecialistListCursor: newest needs createdAt');
    }
    return toBase64Url(
      JSON.stringify({
        v: CURSOR_VERSION,
        k: 'sp',
        s: 'newest',
        t: d.toISOString(),
        i: args.specialistId,
      }),
    );
  }
  if (sort === 'rating') {
    const r = args.ratingAverage;
    if (typeof r !== 'number' || !Number.isFinite(r)) {
      throw new Error('encodeSpecialistListCursor: rating needs ratingAverage');
    }
    return toBase64Url(
      JSON.stringify({
        v: CURSOR_VERSION,
        k: 'sp',
        s: 'rating',
        r,
        i: args.specialistId,
      }),
    );
  }
  throw new Error(
    `encodeSpecialistListCursor: unsupported sort ${String(sort)}`,
  );
}

export function decodeSpecialistListCursor(
  token: string,
): DecodedSpecialistListCursor | null {
  const raw = fromBase64Url(token);
  if (raw == null) {
    return null;
  }
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (p.v !== CURSOR_VERSION || p.k !== 'sp' || typeof p.s !== 'string') {
      return null;
    }
    const s = p.s;
    if (s === 'recommended' || s === 'price_asc' || s === 'price_desc') {
      if (typeof p.o !== 'number' || !Number.isFinite(p.o) || p.o < 0) {
        return null;
      }
      return { sort: s, offset: Math.floor(p.o) };
    }
    if (s === 'popularity') {
      if (typeof p.c !== 'number' || typeof p.i !== 'string') {
        return null;
      }
      if (typeof p.a === 'number' && Number.isFinite(p.a)) {
        return {
          sort: 'popularity',
          reviewsCount: p.c,
          ratingAverage: p.a,
          id: p.i,
        };
      }
      return { sort: 'popularity', reviewsCount: p.c, id: p.i };
    }
    if (s === 'newest') {
      if (typeof p.t !== 'string' || typeof p.i !== 'string') {
        return null;
      }
      return { sort: 'newest', createdAtIso: p.t, id: p.i };
    }
    if (s === 'rating') {
      if (typeof p.r !== 'number' || typeof p.i !== 'string') {
        return null;
      }
      return { sort: 'rating', ratingAverage: p.r, id: p.i };
    }
    return null;
  } catch {
    return null;
  }
}

export function encodeOrganizationListCursor(args: {
  sort: DirectoryListSort;
  organizationId: string;
  name?: string;
  reviewsCount?: number;
  createdAt?: Date;
  ratingAverage?: number;
  offset?: number;
}): string {
  const { sort } = args;
  if (sort === 'recommended' || sort === 'price_asc' || sort === 'price_desc') {
    const o = args.offset;
    if (typeof o !== 'number' || !Number.isFinite(o) || o < 0) {
      throw new Error(
        'encodeOrganizationListCursor: offset required for offset sorts',
      );
    }
    return toBase64Url(
      JSON.stringify({
        v: CURSOR_VERSION,
        k: 'org',
        s: sort,
        o: Math.floor(o),
      }),
    );
  }
  if (sort === 'popularity') {
    const c = args.reviewsCount;
    if (typeof c !== 'number' || !Number.isFinite(c)) {
      throw new Error(
        'encodeOrganizationListCursor: popularity needs reviewsCount',
      );
    }
    const a = args.ratingAverage;
    if (typeof a !== 'number' || !Number.isFinite(a)) {
      throw new Error(
        'encodeOrganizationListCursor: popularity needs ratingAverage',
      );
    }
    return toBase64Url(
      JSON.stringify({
        v: CURSOR_VERSION,
        k: 'org',
        s: 'popularity',
        c,
        a,
        i: args.organizationId,
      }),
    );
  }
  if (sort === 'newest') {
    const d = args.createdAt;
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
      throw new Error('encodeOrganizationListCursor: newest needs createdAt');
    }
    return toBase64Url(
      JSON.stringify({
        v: CURSOR_VERSION,
        k: 'org',
        s: 'newest',
        t: d.toISOString(),
        i: args.organizationId,
      }),
    );
  }
  if (sort === 'rating') {
    const r = args.ratingAverage;
    if (typeof r !== 'number' || !Number.isFinite(r)) {
      throw new Error(
        'encodeOrganizationListCursor: rating needs ratingAverage',
      );
    }
    return toBase64Url(
      JSON.stringify({
        v: CURSOR_VERSION,
        k: 'org',
        s: 'rating',
        r,
        i: args.organizationId,
      }),
    );
  }
  throw new Error(
    `encodeOrganizationListCursor: unsupported sort ${String(sort)}`,
  );
}

export function decodeOrganizationListCursor(
  token: string,
): DecodedOrganizationListCursor | null {
  const raw = fromBase64Url(token);
  if (raw == null) {
    return null;
  }
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (p.v !== CURSOR_VERSION || p.k !== 'org' || typeof p.s !== 'string') {
      return null;
    }
    const s = p.s;
    if (s === 'recommended' || s === 'price_asc' || s === 'price_desc') {
      if (typeof p.o !== 'number' || !Number.isFinite(p.o) || p.o < 0) {
        return null;
      }
      return { sort: s, offset: Math.floor(p.o) };
    }
    if (s === 'popularity') {
      if (typeof p.c !== 'number' || typeof p.i !== 'string') {
        return null;
      }
      if (typeof p.a === 'number' && Number.isFinite(p.a)) {
        return {
          sort: 'popularity',
          reviewsCount: p.c,
          ratingAverage: p.a,
          id: p.i,
        };
      }
      return { sort: 'popularity', reviewsCount: p.c, id: p.i };
    }
    if (s === 'newest') {
      if (typeof p.t !== 'string' || typeof p.i !== 'string') {
        return null;
      }
      return { sort: 'newest', createdAtIso: p.t, id: p.i };
    }
    if (s === 'rating') {
      if (typeof p.r !== 'number' || typeof p.i !== 'string') {
        return null;
      }
      return { sort: 'rating', ratingAverage: p.r, id: p.i };
    }
    return null;
  } catch {
    return null;
  }
}
