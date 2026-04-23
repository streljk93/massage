/** Дефолт размера страницы в API, если не передавать `limit` (`DIRECTORY_LIST_DEFAULT_LIMIT`). */
export const DIRECTORY_CURSOR_PAGE_DEFAULT = 20 as const;

/**
 * Размер страницы на экране поиска: совпадает с числом скелетонов при загрузке / подгрузке.
 */
export const SEARCH_DIRECTORY_CURSOR_PAGE_SIZE = 6 as const;

/** Максимум за один запрос при обходе всех страниц (см. `DIRECTORY_LIST_MAX_LIMIT` в API). */
export const DIRECTORY_CURSOR_FETCH_CHUNK_MAX = 100 as const;
