import type { Metadata, Viewport } from "next";
import { Manrope, Open_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AppProviders } from "@/app/providers";
import "@/app/styles/globals.css";
import type { AppLocale } from "@/app/i18n/routing";
import { routing } from "@/app/i18n/routing";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic", "vietnamese"],
  display: "swap",
});

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin", "cyrillic", "vietnamese"],
  display: "swap",
  style: ["normal", "italic"],
});

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

/** Без pinch-zoom страницы; ориентация дополнительно задаётся в `manifest.ts` и `PortraitOrientationLock`. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    title: {
      default: t("siteName"),
      template: `%s · ${t("siteName")}`,
    },
    description: t("siteDescription"),
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as AppLocale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${manrope.variable} ${openSans.variable} h-full font-sans antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider messages={messages}>
          <AppProviders>{children}</AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
