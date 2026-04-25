import { getBrowserApiV1BaseUrl } from "@/shared/api";
import { getOrCreatePersonalizationSessionId } from "./personalization-session-id";

/** Узкое окно: гасит повтор за ~секунду (React Strict Mode в dev, двойной effect). */
const EVENT_DEDUP_MS = 2500;
const eventDedupLastAt = new Map<string, number>();

function isDuplicateEventWithinWindow(dedupKey: string): boolean {
  const now = Date.now();
  const prev = eventDedupLastAt.get(dedupKey);
  if (prev != null && now - prev < EVENT_DEDUP_MS) {
    return true;
  }
  eventDedupLastAt.set(dedupKey, now);
  if (eventDedupLastAt.size > 300) {
    const cutoff = now - EVENT_DEDUP_MS * 30;
    for (const [k, t] of eventDedupLastAt) {
      if (t < cutoff) {
        eventDedupLastAt.delete(k);
      }
    }
  }
  return false;
}

function postJson(
  url: string,
  body: unknown,
  accessToken: string | undefined,
): void {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  void fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {
    /* аналитика витрины — молча */
  });
}

/**
 * Пакет событий на бэкенд персонализации (без глобальных тостов об ошибках).
 */
export function sendPersonalizationEvents(input: {
  accessToken: string | undefined;
  events: Array<{
    eventType: string;
    entityType?: string | null;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  }>;
}): void {
  const base = getBrowserApiV1BaseUrl();
  const sessionId = getOrCreatePersonalizationSessionId();
  const body = {
    sessionId,
    events: input.events,
  };
  postJson(`${base}/personalization/events`, body, input.accessToken);
}

export function trackSpecialistProfileView(input: {
  accessToken: string | undefined;
  specialistId: string;
}): void {
  const key = `specialist_view:${input.specialistId}`;
  if (isDuplicateEventWithinWindow(key)) {
    return;
  }
  sendPersonalizationEvents({
    accessToken: input.accessToken,
    events: [
      {
        eventType: "specialist_view",
        entityType: "specialist",
        entityId: input.specialistId,
        metadata: {},
      },
    ],
  });
}

export function trackOrganizationProfileView(input: {
  accessToken: string | undefined;
  organizationId: string;
}): void {
  const key = `organization_view:${input.organizationId}`;
  if (isDuplicateEventWithinWindow(key)) {
    return;
  }
  sendPersonalizationEvents({
    accessToken: input.accessToken,
    events: [
      {
        eventType: "organization_view",
        entityType: "organization",
        entityId: input.organizationId,
        metadata: {},
      },
    ],
  });
}

export function trackSearchFiltersApplied(input: {
  accessToken: string | undefined;
  majorSlug: string;
  categorySlugs: string[];
  /** Сортировка из URL: `recommended`, `popularity`, `newest`, `price_asc` / `price_desc`, `rating`. */
  sort?: string;
  radiusM: number | null;
  radiusLat: number | null;
  radiusLng: number | null;
  priceMinVnd: number | null;
  priceMaxVnd: number | null;
}): void {
  const searchKey = [
    "search_apply_filters",
    input.majorSlug,
    [...input.categorySlugs].sort().join(","),
    String(input.sort ?? ""),
    String(input.radiusM),
    String(input.radiusLat),
    String(input.radiusLng),
    String(input.priceMinVnd),
    String(input.priceMaxVnd),
  ].join("|");
  if (isDuplicateEventWithinWindow(searchKey)) {
    return;
  }
  const metadata: Record<string, unknown> = {
    majorSlug: input.majorSlug,
    categorySlugs: input.categorySlugs,
    sort: input.sort,
    priceMinVnd: input.priceMinVnd,
    priceMaxVnd: input.priceMaxVnd,
  };
  if (
    input.radiusM != null &&
    input.radiusLat != null &&
    input.radiusLng != null
  ) {
    metadata.radiusM = input.radiusM;
    metadata.lat = input.radiusLat;
    metadata.lng = input.radiusLng;
  }
  sendPersonalizationEvents({
    accessToken: input.accessToken,
    events: [
      {
        eventType: "search_apply_filters",
        metadata,
      },
    ],
  });
}
