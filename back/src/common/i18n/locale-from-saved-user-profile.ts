import type { ApiLocale } from './api-locale';

/**
 * `User.locale`, сохранённый клиентом (`PATCH /users/me`, синк с `/[locale]/...`).
 * `null`, пустая или неизвестная строка → **`en`**.
 */
export function localeFromSavedUserProfile(
  raw: string | null | undefined,
): ApiLocale {
  const c = (raw ?? 'en').trim().toLowerCase();
  if (c === 'ru' || c === 'vi' || c === 'en') {
    return c;
  }
  if (c.startsWith('ru')) {
    return 'ru';
  }
  if (c.startsWith('vi')) {
    return 'vi';
  }
  return 'en';
}
