import { resolveApiResourceUrl } from "./resolve-api-resource-url";

/** URL для `<img>`: относительные пути API (`/v1/files/…`) собираются через {@link resolveApiResourceUrl}; абсолютные и blob/data не трогаем. */
export function previewSrcForPersistedGalleryUrl(url: string): string {
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("blob:") ||
    url.startsWith("data:")
  ) {
    return url;
  }
  return resolveApiResourceUrl(url);
}
