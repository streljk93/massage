import type { ReactNode } from "react";
import { Inter, Manrope } from "next/font/google";
import { headers } from "next/headers";
import { routing, type AppLocale } from "@/app/i18n/routing";
import { themePreferenceInlineScript } from "@/shared/lib/theme-preference";
import "@/app/styles/globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic", "vietnamese"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic", "vietnamese"],
  display: "swap",
  style: ["normal", "italic"],
});

const APP_LOCALE_HEADER = "x-app-locale";

function isAppLocale(s: string): s is AppLocale {
  return (routing.locales as readonly string[]).includes(s);
}

/**
 * Один разбираемый `Document`: инлайн-тема в `<head>` — только здесь, без дубля в `[locale]`,
 * иначе при soft navigation React 19 ругается на `<script>` в сегменте, который перерисовывается.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const h = await headers();
  const fromHeader = h.get(APP_LOCALE_HEADER);
  const htmlLang: AppLocale =
    fromHeader && isAppLocale(fromHeader) ? fromHeader : routing.defaultLocale;

  return (
    <html
      lang={htmlLang}
      className={`${manrope.variable} ${inter.variable} h-full font-sans antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          id="theme-preference-inline"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themePreferenceInlineScript() }}
        />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
