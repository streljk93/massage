const CURSOR_VERSION = 1 as const;

type SpecialistCursorPayload = {
  v: typeof CURSOR_VERSION;
  k: 'sp';
  /** `User.name` (лексикографический ключ сортировки). */
  n: string;
  /** `Specialist.id`. */
  i: string;
};

type OrganizationCursorPayload = {
  v: typeof CURSOR_VERSION;
  k: 'org';
  /** `Organization.name`. */
  n: string;
  /** `Organization.id`. */
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

export function encodeSpecialistListCursor(
  userName: string,
  specialistId: string,
): string {
  const payload: SpecialistCursorPayload = {
    v: CURSOR_VERSION,
    k: 'sp',
    n: userName,
    i: specialistId,
  };
  return toBase64Url(JSON.stringify(payload));
}

export function decodeSpecialistListCursor(
  token: string,
): { userName: string; id: string } | null {
  const raw = fromBase64Url(token);
  if (raw == null) {
    return null;
  }
  try {
    const p = JSON.parse(raw) as SpecialistCursorPayload;
    if (
      p?.v !== CURSOR_VERSION ||
      p?.k !== 'sp' ||
      typeof p.n !== 'string' ||
      typeof p.i !== 'string'
    ) {
      return null;
    }
    return { userName: p.n, id: p.i };
  } catch {
    return null;
  }
}

export function encodeOrganizationListCursor(
  name: string,
  organizationId: string,
): string {
  const payload: OrganizationCursorPayload = {
    v: CURSOR_VERSION,
    k: 'org',
    n: name,
    i: organizationId,
  };
  return toBase64Url(JSON.stringify(payload));
}

export function decodeOrganizationListCursor(
  token: string,
): { name: string; id: string } | null {
  const raw = fromBase64Url(token);
  if (raw == null) {
    return null;
  }
  try {
    const p = JSON.parse(raw) as OrganizationCursorPayload;
    if (
      p?.v !== CURSOR_VERSION ||
      p?.k !== 'org' ||
      typeof p.n !== 'string' ||
      typeof p.i !== 'string'
    ) {
      return null;
    }
    return { name: p.n, id: p.i };
  } catch {
    return null;
  }
}
