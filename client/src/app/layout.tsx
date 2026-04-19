import type { Metadata } from "next";
import { Manrope, Open_Sans } from "next/font/google";
import { siteConfig } from "@/shared/config";
import { AppProviders } from "@/app/providers";
import "@/app/styles/globals.css";

/** Заголовки: variable (ось wght — все веса). Курсив в Google Fonts для Manrope в next/font недоступен. */
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

/** Текст: variable + прямой и курсив */
const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin", "cyrillic"],
  display: "swap",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${manrope.variable} ${openSans.variable} h-full font-sans antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
