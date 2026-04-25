const STORAGE_KEY = "pzn_sid_v1";

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `pzn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
}

/**
 * Стабильный id анонимной сессии витрины (localStorage), для `POST /personalization/events` у гостя.
 */
export function getOrCreatePersonalizationSessionId(): string {
  if (typeof window === "undefined") {
    return randomId();
  }
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing != null && existing.length >= 8) {
      return existing;
    }
    const next = randomId();
    window.localStorage.setItem(STORAGE_KEY, next);
    return next;
  } catch {
    return randomId();
  }
}

/**
 * Очистить сохранённый id (например при выходе из аккаунта): следующий вызов
 * `getOrCreatePersonalizationSessionId` создаст новый — отдельная гостевая сессия для событий.
 */
export function resetPersonalizationSessionId(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* no-op */
  }
}
