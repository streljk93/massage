const CURSOR_VERSION = 1 as const;

type ReviewCursorPayload = {
  v: typeof CURSOR_VERSION;
  /** `orv` — отзывы о салоне, `srv` — о специалисте (одинаковая форма курсора). */
  k: 'orv' | 'srv';
  /** ISO-8601 `OrganizationReview.createdAt` / `SpecialistReview.createdAt`. */
  t: string;
  /** id отзыва */
  i: string;
};

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

export function encodeReviewListCursor(
  kind: 'orv' | 'srv',
  createdAt: Date,
  id: string,
): string {
  const payload: ReviewCursorPayload = {
    v: CURSOR_VERSION,
    k: kind,
    t: createdAt.toISOString(),
    i: id,
  };
  return toBase64Url(JSON.stringify(payload));
}

export function decodeReviewListCursor(
  token: string,
  kind: 'orv' | 'srv',
): { createdAt: Date; id: string } | null {
  const raw = fromBase64Url(token);
  if (raw == null) {
    return null;
  }
  try {
    const p = JSON.parse(raw) as Partial<ReviewCursorPayload>;
    if (
      p?.v !== CURSOR_VERSION ||
      p?.k !== kind ||
      typeof p.t !== 'string' ||
      typeof p.i !== 'string'
    ) {
      return null;
    }
    const createdAt = new Date(p.t);
    if (Number.isNaN(createdAt.getTime())) {
      return null;
    }
    return { createdAt, id: p.i };
  } catch {
    return null;
  }
}
