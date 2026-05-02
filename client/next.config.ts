import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/app/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  /**
   * Dev по IP в LAN: иначе Next режет WebSocket HMR и часть `/_next/*` (Origin ≠ localhost).
   * Маски — сегменты через точку, `*` на октет (как у `remotePatterns`).
   * Дополнительно: `NEXT_DEV_ALLOWED_ORIGINS=host1,host2` без порта.
   */
  allowedDevOrigins: [
    "10.*.*.*",
    "172.*.*.*",
    "192.168.*.*",
    ...(process.env.NEXT_DEV_ALLOWED_ORIGINS?.split(",")
      .map((h) => h.trim())
      .filter(Boolean) ?? []),
  ],
  /** Атрибут crossorigin у script/head от Next — корректные cross-origin запросы в dev по другому хосту. */
  crossOrigin: "anonymous",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos", pathname: "/**" },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
    ],
  },
};

export default withNextIntl(nextConfig);
