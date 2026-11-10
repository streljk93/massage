import { resolveApiOrigin } from "@/shared/lib/api-origin";

/** Собирает абсолютный URL для путей API (`/v1/files/...`) в браузере. */
export function resolveApiResourceUrl(apiPath: string): string {
  const base = resolveApiOrigin();
  if (apiPath.startsWith("http://") || apiPath.startsWith("https://")) {
    return apiPath;
  }
  if (!base) {
    return apiPath;
  }
  return `${base}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;
}
