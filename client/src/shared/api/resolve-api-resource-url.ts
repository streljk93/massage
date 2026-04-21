/** Собирает абсолютный URL для путей API (`/v1/files/...`) в браузере. */
export function resolveApiResourceUrl(apiPath: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
  if (apiPath.startsWith("http://") || apiPath.startsWith("https://")) {
    return apiPath;
  }
  if (!base) {
    return apiPath;
  }
  return `${base}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;
}
