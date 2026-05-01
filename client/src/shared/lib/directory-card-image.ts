import { resolveApiResourceUrl } from "./resolve-api-resource-url";

const FALLBACK_CARD_IMAGE = "/massage.png";

export function resolveDirectoryImageSrc(
  imageUrl: string | null | undefined,
): string {
  if (!imageUrl) {
    return FALLBACK_CARD_IMAGE;
  }
  if (/^https?:\/\//i.test(imageUrl)) {
    return imageUrl;
  }
  return resolveApiResourceUrl(
    imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`,
  );
}
