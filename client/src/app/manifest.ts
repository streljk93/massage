import type { MetadataRoute } from "next";
import { routing } from "./i18n/routing";

const PWA_ICONS = [
  {
    src: "/pwa/icon-192.png",
    sizes: "192x192",
    type: "image/png",
  },
  {
    src: "/pwa/icon-512.png",
    sizes: "512x512",
    type: "image/png",
  },
] as const;

/** Портрет для установки как PWA; в обычном браузере ориентацию полностью заблокировать нельзя. */
export default function manifest(): MetadataRoute.Manifest {
  const startPath = `/${routing.defaultLocale}/`;

  return {
    id: startPath,
    name: "Services",
    short_name: "Services",
    description:
      "Online booking for massage therapists, salons and specialists in one app.",
    lang: routing.defaultLocale,
    start_url: startPath,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    categories: ["lifestyle", "health"],
    background_color: "#ede9e2",
    theme_color: "#379f94",
    icons: [...PWA_ICONS, ...PWA_ICONS.map((i) => ({ ...i, purpose: "maskable" as const }))],
  };
}
