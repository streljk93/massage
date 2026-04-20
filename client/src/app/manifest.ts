import type { MetadataRoute } from "next";

/** Портрет для установки как PWA; в обычном браузере ориентацию полностью заблокировать нельзя. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Services",
    short_name: "Services",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
  };
}
